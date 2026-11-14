import { describe, expect, it } from "vitest";
import { currentEnvironment, parseOrigin, signInDestination } from "./environments";

describe("environment destinations", () => {
  it("treats this deployment as production unless told otherwise", () => {
    expect(currentEnvironment({})).toBe("production");
    expect(currentEnvironment({ current: "UAT" })).toBe("uat");
    expect(currentEnvironment({ current: "staging" })).toBe("production");
  });

  it("reaches its own environment on this origin, and never invents the other one", () => {
    expect(signInDestination("production", {})).toBe("/sign-in");
    expect(signInDestination("uat", {})).toBeNull();
    expect(signInDestination("production", { current: "uat" })).toBeNull();
    expect(signInDestination("uat", { current: "uat" })).toBe("/sign-in");
  });

  it("goes to each environment's own origin when one is configured", () => {
    const settings = { uatUrl: "https://uat.example.test/", productionUrl: "https://app.example.test" };
    expect(signInDestination("uat", settings)).toBe("https://uat.example.test/sign-in");
    expect(signInDestination("production", settings)).toBe("https://app.example.test/sign-in");
  });

  it("accepts only web origins, and drops any path, query or credentials", () => {
    expect(parseOrigin("javascript:alert(1)")).toBeNull();
    expect(parseOrigin("not a url")).toBeNull();
    expect(parseOrigin("")).toBeNull();
    expect(parseOrigin("https://uat.example.test/some/path?x=1#y")).toBe("https://uat.example.test");
  });
});
