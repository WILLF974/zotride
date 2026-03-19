/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: {
      id: number;
      pseudo: string;
      email: string;
      role: string;
    };
  }
}
