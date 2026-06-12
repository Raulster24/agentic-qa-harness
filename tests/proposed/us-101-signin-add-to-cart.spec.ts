import { test, expect, type Page } from "@playwright/test";

// US-101: Sign in and add a product to the cart (Sauce Demo)
//
// Notes on the application under test:
// - The base URL ("/") renders the login page (Swag Labs).
// - Successful login navigates to "/inventory.html", which shows the "Products" page.
// - The cart badge appears next to the cart link only when the cart is non-empty;
//   it is identified by data-test="shopping-cart-badge" (no distinct accessible role/name).
// - Sauce Demo persists cart contents across sessions (cookies/localStorage), so each
//   test signs in fresh and reasons only about state it creates within the test.

const LOGIN_PATH = "/";
const INVENTORY_PATH = "/inventory.html";

async function login(page: Page, username: string, password: string) {
  await page.goto(LOGIN_PATH);
  await page.getByPlaceholder("Username").fill(username);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

test.describe("US-101: Sign in and add a product to the cart", () => {
  test("AC1: login page is displayed at the base URL with username, password fields and a login control", async ({
    page,
  }) => {
    await page.goto(LOGIN_PATH);

    // Username and password fields (placeholders double as accessible labels here).
    await expect(page.getByPlaceholder("Username")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();

    // Login control.
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("AC2: signing in with standard_user reaches the products page listing products", async ({
    page,
  }) => {
    await login(page, "standard_user", "secret_sauce");

    await expect(page).toHaveURL(new RegExp(`${INVENTORY_PATH}$`));

    // Products page title.
    await expect(page.getByText("Products", { exact: true })).toBeVisible();

    // At least one known product is listed for sale.
    await expect(
      page.getByText("Sauce Labs Backpack", { exact: true })
    ).toBeVisible();
  });

  test("AC3: adding a product to the cart updates the cart indicator to show one item", async ({
    page,
  }) => {
    await login(page, "standard_user", "secret_sauce");
    await expect(page).toHaveURL(new RegExp(`${INVENTORY_PATH}$`));

    // The cart badge is not rendered while the cart is empty.
    const cartBadge = page.locator('[data-test="shopping-cart-badge"]');
    await expect(cartBadge).toHaveCount(0);

    // Add the first product. Each product card has its own "Add to cart" button;
    // scope to the Sauce Labs Backpack card so the locator is unambiguous.
    const backpackCard = page.locator('[data-test="inventory-item"]', {
      hasText: "Sauce Labs Backpack",
    });
    await backpackCard.getByRole("button", { name: "Add to cart" }).click();

    // Cart indicator now shows exactly one item.
    await expect(cartBadge).toBeVisible();
    await expect(cartBadge).toHaveText("1");

    // The product's control flips to "Remove", confirming it was added.
    await expect(
      backpackCard.getByRole("button", { name: "Remove" })
    ).toBeVisible();
  });

  test("AC4: signing in with locked_out_user shows an error and does not reach the products page", async ({
    page,
  }) => {
    await login(page, "locked_out_user", "secret_sauce");

    // Error message is displayed.
    await expect(
      page.getByText("Epic sadface: Sorry, this user has been locked out.")
    ).toBeVisible();

    // We remain on the login page and never reach the products page.
    await expect(page).not.toHaveURL(new RegExp(`${INVENTORY_PATH}$`));
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });
});
