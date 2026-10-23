import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { indiaFacets, parsePostedOn } from "./workday.js";

describe("indiaFacets", () => {
  it("prefers the country parameter in nested facets", () => {
    const facets = [
      {
        facetParameter: "locationMainGroup",
        values: [
          { facetParameter: "locationCountry", values: [{ descriptor: "India", id: "c-in" }, { descriptor: "Germany", id: "c-de" }] },
          { facetParameter: "locations", values: [{ descriptor: "Bengaluru, Karnataka", id: "l-blr" }, { descriptor: "India - Pune", id: "l-pune" }] },
        ],
      },
    ];
    assert.deepEqual(indiaFacets(facets), { locationCountry: ["c-in"] });
  });

  it("falls back to the parameter with most India values", () => {
    const facets = [
      { facetParameter: "locations", values: [{ descriptor: "Bangalore", id: "a" }, { descriptor: "Remote India", id: "b" }] },
      { facetParameter: "timeType", values: [{ descriptor: "Full time", id: "ft" }] },
    ];
    assert.deepEqual(indiaFacets(facets), { locations: ["a", "b"] });
  });

  it("returns null without any India value", () => {
    assert.equal(indiaFacets([{ facetParameter: "locations", values: [{ descriptor: "Austin, TX", id: "x" }] }]), null);
  });
});

describe("parsePostedOn", () => {
  const now = new Date("2026-10-23T15:00:00Z");
  it("reads Today, Yesterday and N Days Ago", () => {
    assert.equal(parsePostedOn("Posted Today", now), "2026-10-23T00:00:00.000Z");
    assert.equal(parsePostedOn("Posted Yesterday", now), "2026-10-22T00:00:00.000Z");
    assert.equal(parsePostedOn("Posted 3 Days Ago", now), "2026-10-20T00:00:00.000Z");
    assert.equal(parsePostedOn("Posted 30+ Days Ago", now), "2026-09-23T00:00:00.000Z");
  });
  it("returns null for anything else", () => {
    assert.equal(parsePostedOn("Recently", now), null);
    assert.equal(parsePostedOn(null, now), null);
  });
});
