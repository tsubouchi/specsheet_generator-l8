import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

// 必須トークンが無い場合はスキップ
const ACCESS = process.env.DRIVE_ACCESS_TOKEN;
const IDTOKEN = process.env.FIREBASE_ID_TOKEN;

(ACCESS && IDTOKEN ? test : test.skip)(
  'POST /api/drive-upload should return Drive link',
  async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/drive-upload`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${IDTOKEN}`,
      },
      data: {
        markdown: '# E2E Test',
        driveAccessToken: ACCESS,
        public: false,
      },
    });
    expect(resp.ok()).toBeTruthy();
    const json = await resp.json();
    expect(json).toHaveProperty('webViewLink');
  }
); 