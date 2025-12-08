/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const log = (...args: unknown[]) => {
  console.log("[bookmarket-sw]", ...args);
};

self.addEventListener("install", () => {
  log("installed");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  log("activated");
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PING") {
    event.ports[0]?.postMessage({ type: "PONG" });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  log("alarm fired", alarm.name);
});

