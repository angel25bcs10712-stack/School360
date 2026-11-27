import test from "node:test";
import assert from "node:assert/strict";
import { classifyCategory, classifyIntent } from "../../frontend/intent-service.mjs";

test("classifies the five supported intents in Hindi and English", () => {
  assert.equal(classifyIntent("मुझे कानपुर के सरकारी स्कूलों की जानकारी चाहिए"), "SEARCH_SCHOOL");
  assert.equal(classifyIntent("Find government schools in Kanpur"), "SEARCH_SCHOOL");
  assert.equal(classifyIntent("क्या इस स्कूल में पीने का पानी उपलब्ध है?"), "GET_INFRASTRUCTURE_INFO");
  assert.equal(classifyIntent("इस स्कूल की पानी की टंकी खराब है"), "REPORT_ISSUE");
  assert.equal(classifyIntent("The classroom roof is broken"), "REPORT_ISSUE");
  assert.equal(classifyIntent("मेरी शिकायत का क्या हुआ?"), "CHECK_REPORT_STATUS");
  assert.equal(classifyIntent("What is the status of my complaint?"), "CHECK_REPORT_STATUS");
  assert.equal(classifyIntent("आप मेरी कैसे मदद कर सकते हैं?"), "GENERAL_HELP");
});

test("extracts issue categories and keeps availability questions informational", () => {
  assert.equal(classifyCategory("पानी की टंकी खराब है"), "WATER");
  assert.equal(classifyCategory("शौचालय साफ नहीं होता"), "CLEANLINESS");
  assert.equal(classifyCategory("बिजली नहीं आती"), "ELECTRICITY");
  assert.equal(classifyCategory("कक्षा की छत टूट रही है"), "CLASSROOM");
  assert.equal(classifyCategory("बेंच टूटी हुई है"), "FURNITURE");
  assert.equal(classifyIntent("शौचालय की सफाई नहीं होती"), "REPORT_ISSUE");
  assert.equal(classifyCategory("शौचालय की सफाई नहीं होती"), "CLEANLINESS");
  assert.equal(classifyCategory("The electrical power is broken"), "ELECTRICITY");
  assert.equal(classifyIntent("क्या पीने का पानी उपलब्ध है?"), "GET_INFRASTRUCTURE_INFO");
  assert.equal(classifyCategory("क्या पीने का पानी उपलब्ध है?"), "WATER");
});
