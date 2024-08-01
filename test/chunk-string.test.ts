import { chunkString } from "../src/chunk-string";
import { expect, test } from "vitest";

test("empty string", () => {
  expect(chunkString("", 2)).toEqual([""]);
});

test("provided: 1, chunkSize: 2", () => {
  expect(chunkString("a", 2)).toEqual(["a"]);
});

test("provided: 2, chunkSize: 2", () => {
  expect(chunkString("ab", 2)).toEqual(["ab"]);
});

test("provided: 3, chunkSize: 2", () => {
  expect(chunkString("abc", 2)).toEqual(["ab", "c"]);
});

test("provided: 3, chunkSize: 3", () => {
  expect(chunkString("abc", 3)).toEqual(["abc"]);
});

test("provided: 4, chunkSize: 2", () => {
  expect(chunkString("abcd", 2)).toEqual(["ab", "cd"]);
});
