/**
 * upworkScraper.ts
 *
 * Connects to the already-running Chromium instance (--remote-debugging-port=9222)
 * and uses the authenticated Upwork session to fetch rooms + message stories
 * via Upwork's internal REST API.
 *
 * Auth strategy:
 *   Reads the `{nid}_api_token` value from the page's localStorage and passes
 *   it as a Bearer token. This is the same token the Upwork SPA uses for its
 *   own API calls, so no login is required — we just reuse the existing session.
 *
 * No login required — reuses the existing browser session.
 */

import puppeteer, { Browser, Page } from "puppeteer-core";

const REMOTE_DEBUGGING_URL = "http://127.0.0.1:9222";
const ORG_ID = process.env.UPWORK_ORG_ID || "1681372983093714945";
const OWNER_USER_ID = process.env.UPWORK_CLIENT_USER_ID || "1681372983093714944";
const ROOMS_LIMIT = 50;
const STORIES_LIMIT = 20;

export interface UpworkStory {
  storyId: string;
  userId: string;
  message: string;
  createdAt: number; // unix ms
}

export interface UpworkRoom {
  roomId: string;
  roomName: string;
  latestStory: UpworkStory | null;
  stories: UpworkStory[];
}

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  _browser = await puppeteer.connect({
    browserURL: REMOTE_DEBUGGING_URL,
    defaultViewport: null,
  });
  return _browser;
}

async function getUpworkPage(browser: Browser): Promise<Page> {
  const pages = await browser.pages();
  // Prefer an existing Upwork page
  for (const page of pages) {
    const url = page.url();
    if (url.includes("upwork.com")) return page;
  }
  // Otherwise open a new one
  const page = await browser.newPage();
  await page.goto("https://www.upwork.com/ab/messages/", {
    waitUntil: "networkidle2",
    timeout: 30_000,
  });
  return page;
}

/**
 * Read the Bearer token that the Upwork SPA stores in localStorage.
 * Key pattern: `{nid}_api_token` where nid comes from `auth-store-data`.
 * Returns null if the session is not logged in or the token is missing.
 */
async function getBearerToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const authRaw = localStorage.getItem("auth-store-data");
      if (!authRaw) return null;
      const authData = JSON.parse(authRaw) as Record<string, string>;
      const nid = authData["auth/user/setNid"];
      if (!nid) return null;
      return localStorage.getItem(`${nid}_api_token`);
    } catch {
      return null;
    }
  });
}

async function fetchViaPage<T>(page: Page, url: string, bearerToken: string): Promise<T> {
  const result = await page.evaluate(
    async (fetchUrl: string, token: string) => {
      const resp = await fetch(fetchUrl, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      return resp.json();
    },
    url,
    bearerToken
  );
  return result as T;
}

interface RoomsResponse {
  rooms: Array<{
    roomId: string;
    roomName: string;
    topic?: string;
    latestStory?: {
      storyId: string;
      userId: string;
      message?: string;
      /** Raw API uses `created` (unix ms) */
      created?: number;
    };
  }>;
}

interface StoriesResponse {
  stories: Array<{
    storyId: string;
    userId: string;
    message?: string;
    /** Raw API uses `created` (unix ms) */
    created?: number;
    isSystemStory?: number;
    deleted?: number;
  }>;
}

export async function fetchUpworkRooms(): Promise<UpworkRoom[]> {
  const browser = await getBrowser();
  const page = await getUpworkPage(browser);

  const bearerToken = await getBearerToken(page);
  if (!bearerToken) {
    throw new Error(
      "Upwork Bearer token not found in localStorage. " +
        "Please ensure the browser is open and logged into Upwork."
    );
  }

  const roomsUrl = `https://www.upwork.com/api/v3/rooms/rooms/simplified?callerOrgId=${ORG_ID}&limit=${ROOMS_LIMIT}`;
  const roomsData = await fetchViaPage<RoomsResponse>(page, roomsUrl, bearerToken);

  const rooms: UpworkRoom[] = [];

  for (const room of roomsData.rooms || []) {
    const storiesUrl = `https://www.upwork.com/api/v3/rooms/rooms/${room.roomId}/stories/simplified?limit=${STORIES_LIMIT}&callerOrgId=${ORG_ID}`;
    let stories: UpworkStory[] = [];

    try {
      const storiesData = await fetchViaPage<StoriesResponse>(page, storiesUrl, bearerToken);
      stories = (storiesData.stories || [])
        // Filter out system stories (join/leave events) and deleted messages
        .filter((s) => !s.isSystemStory && !s.deleted)
        .map((s) => ({
          storyId: s.storyId,
          userId: s.userId,
          message: s.message || "",
          createdAt: s.created || 0, // map `created` → `createdAt`
        }));
    } catch {
      // If stories fetch fails, continue with empty stories
    }

    const latestStory = room.latestStory
      ? {
          storyId: room.latestStory.storyId,
          userId: room.latestStory.userId,
          message: room.latestStory.message || "",
          createdAt: room.latestStory.created || 0, // map `created` → `createdAt`
        }
      : null;

    rooms.push({
      roomId: room.roomId,
      roomName: room.roomName,
      latestStory,
      stories,
    });
  }

  return rooms;
}

export { OWNER_USER_ID };
