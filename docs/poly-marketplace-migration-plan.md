# 🛒️ Poly-Marketplace Migration Plan

**Source:** `C:\laragon\www\myAgency` (Laravel CMS)  
**Target:** `C:\laragon\www\poly-marketplace` (Multi-vendor marketplace)  
**Method:** OpenCode agents + ambient LSP feedback + workflow orchestration

---

## 📂 Current Architecture (myAgency CMS)

| Layer              | Current                    | Purpose                                                             |
| ------------------ | -------------------------- | ------------------------------------------------------------------- |
| **Settings**       | `Settings.php`             | Global: topbar, bottombar, popular_products, deal_of_day, etc.      |
| **PageSettings**   | `Pagesetting.php`          | Per-page: featured_banner_id, component, status, page_id            |
| **Sections**       | `Section.php`              | Page sections: title, subtitle, text, button, position, label, link |
| **Pages**          | `Page.php`                 | Pages: title, slug, description, meta, language_id, status          |
| **Livewire Admin** | `app/Http/Livewire/Admin/` | About, Backup, Blog, Category, Customer, Email, etc.                |
| **Livewire Front** | `app/Http/Livewire/Front/` | Account, Blogs, Contact, Newsletters, SearchBox, etc.               |
| **Models**         | `app/Models/`              | Blog, Category, Contact, EmailSetting, PageSetting, Section, etc.   |

---

## 🎯 Target Architecture (Poly-Marketplace)

| Layer                    | Target                   | Purpose                                                          |
| ------------------------ | ------------------------ | ---------------------------------------------------------------- |
| **Marketplace Settings** | `MarketplaceSetting.php` | Commission rates, vendor rules, payout settings, currency, tax   |
| **Vendor Settings**      | `VendorSetting.php`      | Per-vendor: store settings, shipping, return policy              |
| **Product Pages**        | `ProductPage.php`        | Marketplace pages: home, vendor dashboard, product detail        |
| **Marketplace Sections** | `MarketplaceSection.php` | Hero, featured products, vendor cards, testimonials, CTA         |
| **Livewire Admin**       | `Livewire/Admin/`        | Vendor management, product moderation, order management, payouts |
| **Livewire Vendor**      | `Livewire/Vendor/`       | Vendor dashboard, product CRUD, order tracking, analytics        |
| **Livewire Front**       | `Livewire/Front/`        | Product browsing, vendor pages, cart, checkout, reviews          |
| **Models**               | `app/Models/`            | Product, Vendor, Order, OrderItem, Review, Category, etc.        |

---

## 🚀 Migration Phases (Copy-Paste Prompts)

### Phase 1: Settings → Marketplace Settings

**Goal:** Transform global CMS settings into marketplace configuration.

```
/agent lead-architect

Migrate Settings from myAgency CMS to Poly-Marketplace:

Context:
- Source: C:\laragon\www\myAgency\app\Models\Setting.php
- Source: C:\laragon\www\myAgency\app\Models\Pagesetting.php
- Target: C:\laragon\www\poly-marketplace\app\Models\MarketplaceSetting.php
- Target: C:\laragon\www\poly-marketplace\app\Models\VendorSetting.php

Task:
1. ANALYZE current Setting.php and Pagesetting.php fields
2. DESIGN MarketplaceSetting fields:
   - commission_rate (decimal)
   - vendor_approval_required (boolean)
   - payout_schedule (enum: daily, weekly, monthly)
   - currency (string, default: USD)
   - tax_rate (decimal)
   - featured_products_enabled (boolean)
   - deal_of_the_day_enabled (boolean)
3. DESIGN VendorSetting fields (per-vendor):
   - vendor_id (foreign key)
   - store_name, store_description
   - shipping_policy, return_policy
   - commission_override (nullable decimal)
   - status (boolean)
4. CREATE migrations using laravel-feature-scaffold skill
5. UPDATE config: add marketplace settings page to Admin Livewire

Tools:
- Use laravel-feature-scaffold skill for consistent structure
- Use context7 MCP for latest Laravel docs on migrations
- Use ambient LSP feedback (auto-detects syntax errors)
- Use sqlite MCP to generate test data

Exit criteria: Migrations run successfully + model tests pass
```

---

### Phase 2: Pages → Marketplace Pages

**Goal:** Transform CMS pages into marketplace page structure.

```
/agent backend-laravel

Migrate Pages from myAgency CMS to Poly-Marketplace structure:

Context:
- Source: C:\laragon\www\myAgency\app\Models\Page.php
- Source: C:\laragon\www\myAgency\app\Models\Pagesetting.php
- Target: C:\laragon\www\poly-marketplace\app\Models\ProductPage.php
- Reference: C:\laragon\www\poly-marketplace\docs\ (if exists)

Task:
1. ANALYZE current Page.php and Pagesetting.php
2. DESIGN ProductPage model with:
   - title, slug, description, meta_title, meta_description
   - page_type (enum: home, vendor_dashboard, product_detail, cart, checkout)
   - language_id (multi-language support)
   - status (boolean)
3. CREATE ProductPageController with CRUD operations
4. CREATE Form Requests: StoreProductPageRequest, UpdateProductPageRequest
5. SETUP Livewire component: app/Http/Livewire/Admin/ProductPage.php
6. ADD routes in routes/web.php

Tools:
- Use laravel-feature-scaffold skill
- Use parallel_groups: [controller, model, form_requests] in same turn
- Use ambient LSP feedback for immediate error detection
- Use retry_policy: 3 attempts with exponential backoff

Exit criteria: All tests pass AND no LSP errors detected
```

---

### Phase 3: Sections → Marketplace Sections

**Goal:** Transform CMS sections into marketplace section components.

```
/agent backend-laravel

Migrate Sections from myAgency CMS to Poly-Marketplace sections:

Context:
- Source: C:\laragon\www\myAgency\app\Models\Section.php
- Source: C:\laragon\www\myAgency\app\Http\Livewire\Admin\ (various section components)
- Target: C:\laragon\www\poly-marketplace\app\Models\MarketplaceSection.php

Task:
1. ANALYZE current Section.php (title, subtitle, text, button, position, label, link, embedded_video)
2. DESIGN MarketplaceSection model:
   - section_type (enum: hero, featured_products, vendor_cards, testimonials, cta, newsletter)
   - title, subtitle, text, button_text, button_link
   - background_color, text_color
   - position (integer for ordering)
   - page_id (foreign key to ProductPage)
   - status (boolean)
3. CREATE MarketplaceSectionController with:
   - index (list sections by page)
   - store, update, destroy
4. CREATE Livewire components:
   - Admin/MarketplaceSection.php (CRUD in admin)
   - Front/HeroSection.php, Front/FeaturedProducts.php, etc.
5. ADD section rendering in frontend views

Tools:
- Use laravel-feature-scaffold skill
- Use ui-ux-pro-max skill for frontend section design
- Use parallel_groups: [model, controller, admin_livewire, front_livewire]
- Use ambient LSP feedback (auto-injects PHP syntax errors)

Exit criteria: Section CRUD works + frontend renders sections correctly
```

---

### Phase 4: Livewire Admin → Vendor/Admin Dashboard

**Goal:** Transform admin components into marketplace admin + vendor management.

```
/agent backend-laravel

Migrate Admin Livewire components to Poly-Marketplace Admin + Vendor dashboards:

Context:
- Source: C:\laragon\www\myAgency\app\Http\Livewire\Admin\ (About, Backup, Blog, Category, Customer, etc.)
- Target: C:\laragon\www\poly-marketplace\app\Http\Livewire\Admin\
- Target: C:\laragon\www\poly-marketplace\app\Http\Livewire\Vendor\

Task:
1. ANALYZE current Admin Livewire components
2. CREATE new Admin components:
   - VendorManagement.php (approve/reject vendors)
   - ProductModeration.php (approve/reject products)
   - OrderManagement.php (view all orders, update status)
   - PayoutManagement.php (process vendor payouts)
   - MarketplaceSettings.php (commission, currency, tax)
3. CREATE Vendor components:
   - VendorDashboard.php (sales analytics, order tracking)
   - VendorProducts.php (CRUD for vendor's products)
   - VendorOrders.php (view and update order status)
   - VendorSettings.php (store settings, shipping, policies)
4. UPDATE routes in routes/web.php for new admin + vendor prefixes

Tools:
- Use laravel-feature-scaffold skill for each component
- Use parallel_groups: [admin_components, vendor_components] (run simultaneously)
- Use ambient LSP feedback for immediate error detection
- Use retry_policy: 3 attempts

Exit criteria: All components render + no LSP errors + basic functionality works
```

---

### Phase 5: Livewire Front → Marketplace Frontend

**Goal:** Transform frontend components into marketplace browsing + checkout.

```
/agent backend-laravel

Migrate Front Livewire components to Poly-Marketplace frontend:

Context:
- Source: C:\laragon\www\myAgency\app\Http\Livewire\Front\ (Account, Blogs, Contact, SearchBox, etc.)
- Target: C:\laragon\www\poly-marketplace\app\Http\Livewire\Front\

Task:
1. ANALYZE current Front Livewire components
2. CREATE marketplace frontend components:
   - HomePage.php (renders MarketplaceSections: hero, featured, etc.)
   - ProductBrowser.php (filter by category, price, vendor)
   - ProductDetail.php (product info, vendor info, reviews)
   - VendorPage.php (vendor storefront, their products)
   - Cart.php (add/remove items, calculate totals)
   - Checkout.php (shipping, payment, order placement)
   - ProductReviews.php (list reviews, submit review)
   - SearchBox.php (search products by name, category, vendor)
3. UPDATE routes for frontend navigation
4. CREATE views for each component (Tailwind + Livewire)

Tools:
- Use laravel-feature-scaffold skill
- Use ui-ux-pro-max skill for frontend design (color palette, typography)
- Use parallel_groups: [browser_components, cart_checkout, reviews_search] (simultaneous)
- Use ambient LSP feedback (auto-detects syntax errors)

Exit criteria: Frontend renders + cart works + checkout flow functional
```

---

### Phase 6: Models → Marketplace Models (Products, Vendors, Orders)

**Goal:** Create core marketplace models with relationships.

```
/agent backend-laravel

Create Poly-Marketplace core models:

Context:
- Source: C:\laragon\www\myAgency\app\Models\ (Blog, Category, Contact, etc.)
- Target: C:\laragon\www\poly-marketplace\app\Models\

Task:
1. CREATE Product model:
   - name, slug, description, price, compare_price
   - vendor_id (foreign key), category_id (foreign key)
   - stock_quantity, sku
   - status (enum: active, draft, out_of_stock)
   - Relationships: vendor(), category(), orderItems(), reviews()
2. CREATE Vendor model:
   - user_id, store_name, store_description
   - commission_rate (nullable, overrides global)
   - status (enum: pending, approved, suspended)
   - Relationships: user(), products(), orders()
3. CREATE Order model:
   - order_number, vendor_id, user_id
   - subtotal, tax_amount, commission_amount, total
   - status (enum: pending, processing, shipped, delivered, cancelled)
   - Relationships: vendor(), user(), items()
4. CREATE OrderItem model:
   - order_id, product_id, quantity, price, commission
5. CREATE Review model:
   - product_id, user_id, vendor_id
   - rating (1-5), title, comment
   - Relationships: product(), user(), vendor()
6. ADD migrations, factories, and Pest tests for all models

Tools:
- Use laravel-feature-scaffold skill for each model
- Use parallel_groups: [product_vendor, order_item, review] (simultaneous)
- Use sqlite MCP to generate test data
- Use ambient LSP feedback for syntax errors

Exit criteria: All migrations run + model tests pass (>80% coverage)
```

---

### Phase 7: Integration & Testing

**Goal:** Wire everything together and test the full marketplace flow.

```
/agent lead-strategist

Coordinate full Poly-Marketplace integration and testing:

Context:
- Project: C:\laragon\www\poly-marketplace
- All phases 1-6 should be completed

Task:
1. ANALYZE all created components, models, and relationships
2. DELEGATE to backend-laravel:
   - Test vendor registration flow
   - Test product creation by vendor
   - Test customer browsing and cart addition
   - Test checkout and order placement
   - Test vendor payout calculation
3. DELEGATE to frontend-ui-ux:
   - Verify all frontend components render correctly
   - Test responsive design (mobile, tablet, desktop)
   - Check Tailwind styling consistency
4. DELEGATE to qa-guardian:
   - Run full test suite (Pest)
   - Security audit (SQL injection, XSS, CSRF)
   - Performance test (page load times)
   - Generate test coverage report

Tools:
- Use workflow-manager skill for multi-phase coordination
- Use parallel_groups: [backend_tests, frontend_tests, qa_audit] (simultaneous)
- Use sqlite MCP for test data generation
- Use memory MCP to persist test results
- Use security scanning feature for vulnerability detection

Exit criteria:
- All tests pass (>80% coverage)
- No critical/high security issues
- Page load times <2 seconds
- Full marketplace flow works (vendor → product → customer → order → payout)
```

---

## 📋 Quick Reference: Agent + Skill Combinations

| Phase          | Agent                                | Skill(s)                                    | MCP Tools                    |
| -------------- | ------------------------------------ | ------------------------------------------- | ---------------------------- |
| 1: Settings    | `lead-architect`                     | `laravel-feature-scaffold`                  | context7, sqlite             |
| 2: Pages       | `backend-laravel`                    | `laravel-feature-scaffold`                  | context7, ambient LSP        |
| 3: Sections    | `backend-laravel`                    | `laravel-feature-scaffold`, `ui-ux-pro-max` | context7, ambient LSP        |
| 4: Admin       | `backend-laravel`                    | `laravel-feature-scaffold`                  | ambient LSP, parallel_groups |
| 5: Frontend    | `backend-laravel` + `frontend-ui-ux` | `laravel-feature-scaffold`, `ui-ux-pro-max` | ambient LSP, parallel_groups |
| 6: Models      | `backend-laravel`                    | `laravel-feature-scaffold`                  | sqlite, ambient LSP          |
| 7: Integration | `lead-strategist`                    | `workflow-manager`, `testing-strategy`      | sqlite, memory, security     |

---

## 💡 Pro Tips for Migration

1. **Use `/agent` to switch** between agents for each phase
2. **Use `route_agent`** if unsure which agent to use
3. **Use `laravel-feature-scaffold` skill** for consistent CRUD structure
4. **Use `ui-ux-pro-max` skill** for frontend design consistency
5. **Ambient LSP Feedback** will auto-detect syntax errors after each edit
6. **Use `parallel_groups`** for independent tasks within each phase
7. **Use `retry_policy: 3 attempts`** for resilience
8. **Use `sqlite MCP`** to generate test data
9. **Use `memory MCP`** to persist progress across sessions

---

> [!TIP]
> Start with Phase 1 and work sequentially. Each phase builds on the previous one. Use `/agent lead-strategist` to coordinate complex multi-phase workflows.
