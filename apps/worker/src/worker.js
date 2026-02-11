import { chromium } from "playwright";
import { getPool } from "./db.js";
import { v4 as uuidv4 } from "uuid";

const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

async function getNextJob(pool) {
  const { rows } = await pool.query(`
    UPDATE jobs
    SET status='running', started_at=NOW()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status='pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  return rows[0] || null;
}

async function saveResult(pool, jobId, data) {
  await pool.query(
    `
    INSERT INTO results
    (id, job_id, name, category, address, phone, website, rating, reviews_count, lat, lng)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  `,
    [
      uuidv4(),
      jobId,
      data.name || null,
      data.category || null,
      data.address || null,
      data.phone || null,
      data.website || null,
      data.rating || null,
      data.reviews_count || null,
      data.lat || null,
      data.lng || null
    ]
  );
}

async function markDone(pool, jobId, total) {
  await pool.query(
    `UPDATE jobs SET status='completed', total_found=$2, finished_at=NOW() WHERE id=$1`,
    [jobId, total]
  );
}

async function markFailed(pool, jobId, err) {
  await pool.query(
    `UPDATE jobs SET status='failed', error=$2, finished_at=NOW() WHERE id=$1`,
    [jobId, String(err).slice(0, 1000)]
  );
}

async function scrapeGoogleMaps(page, keyword, location, maxResults = 40) {
  const query = encodeURIComponent(`${keyword} ${location}`);
  const url = `https://www.google.com/maps/search/${query}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await SLEEP(4000);

  const results = [];
  const seen = new Set();

  const panel = page.locator('div[role="feed"]');

  for (let i = 0; i < 30; i++) {
    const cards = page.locator('a[href^="https://www.google.com/maps/place"]');
    const count = await cards.count();

    for (let c = 0; c < count; c++) {
      const href = await cards.nth(c).getAttribute("href");
      if (!href || seen.has(href)) continue;
      seen.add(href);

      await cards.nth(c).click();
      await SLEEP(2500);

      const name = await page.locator("h1").first().textContent().catch(() => null);

      const address = await page
        .locator('button[data-item-id="address"] div[aria-label]')
        .first()
        .getAttribute("aria-label")
        .catch(() => null);

      const phone = await page
        .locator('button[data-item-id^="phone:tel"] div[aria-label]')
        .first()
        .getAttribute("aria-label")
        .catch(() => null);

      const website = await page
        .locator('a[data-item-id="authority"]')
        .first()
        .getAttribute("href")
        .catch(() => null);

      const ratingText = await page
        .locator('div[role="img"][aria-label*="stars"]')
        .first()
        .getAttribute("aria-label")
        .catch(() => null);

      let rating = null;
      if (ratingText) {
        const m = ratingText.match(/([0-9.]+)\s+stars/);
        if (m) rating = Number(m[1]);
      }

      const reviewsText = await page
        .locator('button[jsaction*="reviews"] span')
        .first()
        .textContent()
        .catch(() => null);

      let reviews_count = null;
      if (reviewsText) {
        const num = reviewsText.replace(/[^\d]/g, "");
        if (num) reviews_count = Number(num);
      }

      results.push({
        name: name?.trim() || null,
        address: address || null,
        phone: phone || null,
        website: website || null,
        rating,
        reviews_count,
        category: null,
        lat: null,
        lng: null
      });

      if (results.length >= maxResults) return results;
    }

    if (await panel.count()) {
      await panel.evaluate((el) => el.scrollBy(0, 1500));
    } else {
      await page.mouse.wheel(0, 1500);
    }

    await SLEEP(2000);
  }

  return results;
}

async function main() {
  console.log("Worker started...");
  const pool = getPool();

  while (true) {
    const job = await getNextJob(pool);

    if (!job) {
      await SLEEP(3000);
      continue;
    }

    console.log(`Running job: ${job.keyword} + ${job.location}`);

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
    });

    const context = await browser.newContext({
      locale: "en-US",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    });

    const page = await context.newPage();

    try {
      await pool.query(`DELETE FROM results WHERE job_id=$1`, [job.id]);

      const maxResults = 40;
      const data = await scrapeGoogleMaps(page, job.keyword, job.location, maxResults);

      for (const row of data) {
        await saveResult(pool, job.id, row);
      }

      await markDone(pool, job.id, data.length);
      console.log(`Completed job ${job.id} with ${data.length} results`);
    } catch (err) {
      console.error("Job failed:", err);
      await markFailed(pool, job.id, err);
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }

    await SLEEP(1500);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
