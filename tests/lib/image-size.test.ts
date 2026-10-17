import { describe, expect, it } from "vitest";
import { imageSize } from "@/lib/image-size";

// Images rouges de 37 × 21 px générées par ImageMagick.
const SAMPLES: Record<string, string> = {
  "a.jpg": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAVACUDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAcJ/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AnRDGqYAAAAAAAAAAAAAD/9k=",
  "a.png": "iVBORw0KGgoAAAANSUhEUgAAACUAAAAVAQMAAAD7KrXtAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAADUExURf8AABniCTcAAAAHdElNRQfqChECGSPj/bYbAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI2LTEwLTE3VDAyOjI1OjM1KzAwOjAwY/vbiAAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNi0xMC0xN1QwMjoyNTozNSswMDowMBKmYzQAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjYtMTAtMTdUMDI6MjU6MzUrMDA6MDBFs0LrAAAADElEQVQI12NgGEgAAAB+AAH9tTdSAAAAAElFTkSuQmCC",
  "a.webp": "UklGRk4AAABXRUJQVlA4IEIAAACQAwCdASolABUAPm02l0ikIyIhJWgAgA2JZwDPkoB+AAAr98NwAP7wm0P/5BcsLrka//yA/5Af8gP/498Ql180AAA=",
  "b.webp": "UklGRhwAAABXRUJQVlA4TA8AAAAvJAAFAAcQ/Y/+ByKi/wEA",
  "c.webp": "UklGRnIAAABXRUJQVlA4WAoAAAAQAAAAJAAAFAAAQUxQSAoAAAABB1DAiAhERP8DVlA4IEIAAACQAwCdASolABUAPm02l0ikIyIhJWgAgA2JZwDPkoB+AAAr98NwAP7wm0P/5BcsLrka//yA/5Af8gP/498Ql180AAA=",
};
const bytes = (name: string) => new Uint8Array(Buffer.from(SAMPLES[name], "base64"));

describe("Dimensions d'une image (photothèque)", () => {
  it.each(Object.keys(SAMPLES))("%s : 37 × 21", (name) => {
    expect(imageSize(bytes(name))).toEqual({ width: 37, height: 21 });
  });

  it("fichier inconnu ou tronqué : null", () => {
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(imageSize(bytes("a.jpg").subarray(0, 40))).toBeNull();
  });
});
