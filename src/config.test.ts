import { describe, it, expect, beforeEach } from "vitest";
import {
  ALLOWED_USERS,
  MAX_MESSAGE_LOG,
  DEFAULT_MODEL_ID,
  PRO_MODEL_ID,
  BOT_USERNAME,
  setBotUsername,
  isAllowedUser,
} from "./config.js";

describe("config", () => {
  beforeEach(() => {
    // Reset BOT_USERNAME to undefined between tests
    setBotUsername(undefined);
  });

  describe("constants", () => {
    it("should define ALLOWED_USERS with nawarian", () => {
      expect(ALLOWED_USERS).toEqual(["nawarian"]);
    });

    it("should have MAX_MESSAGE_LOG set to 500", () => {
      expect(MAX_MESSAGE_LOG).toBe(500);
    });

    it("should have DEFAULT_MODEL_ID set to deepseek-v4-flash", () => {
      expect(DEFAULT_MODEL_ID).toBe("deepseek-v4-flash");
    });

    it("should have PRO_MODEL_ID set to deepseek-v4-pro", () => {
      expect(PRO_MODEL_ID).toBe("deepseek-v4-pro");
    });
  });

  describe("BOT_USERNAME", () => {
    it("should start as undefined", () => {
      expect(BOT_USERNAME).toBeUndefined();
    });

    it("should be settable via setBotUsername", () => {
      setBotUsername("MyBot");
      expect(BOT_USERNAME).toBe("MyBot");
    });

    it("should be resettable to undefined", () => {
      setBotUsername("MyBot");
      setBotUsername(undefined);
      expect(BOT_USERNAME).toBeUndefined();
    });
  });

  describe("isAllowedUser", () => {
    it("should return false for undefined username", () => {
      expect(isAllowedUser(undefined)).toBe(false);
    });

    it("should return false for unknown usernames", () => {
      expect(isAllowedUser("stranger")).toBe(false);
    });

    it("should return true for nawarian (exact case)", () => {
      expect(isAllowedUser("nawarian")).toBe(true);
    });

    it("should return true for NAWARIAN (case insensitive)", () => {
      expect(isAllowedUser("NAWARIAN")).toBe(true);
    });

    it("should return true for NaWaRiAn (mixed case)", () => {
      expect(isAllowedUser("NaWaRiAn")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isAllowedUser("")).toBe(false);
    });
  });
});
