**Volume 4 --- SDTA**

**BOOK 5 --- Frontend Architecture**

Enterprise Comprehensive Edition --- Flutter Frontend Engineering
Architecture

Enterprise ERP Solution Design & Technical Architecture

Implementation-ready frontend reference for Flutter Web, Desktop, Tablet
and Mobile

Prepared for: Abdullah Maresh \| Date: 08 July 2026

# **Document Context and Consistency Statement**

This document implements BOOK 5 --- Frontend Architecture according to
the approved SDTA structure. It builds on the
backend/API/security/database architecture already established in Books
1--4, and translates the ERP product experience into a precise frontend
engineering architecture for Flutter. It does not redesign previous
architecture decisions and does not duplicate module FTS content; it
defines how the frontend shall be structured, secured, localized,
routed, tested, optimized and delivered.

تم إعداد هذا الملف كنسخة موسعة ومفصلة جدًا من Book 5 وبصيغة Word
احترافية، ليكون مرجعًا مباشرًا لفريق الواجهة الأمامية وUI/UX وQA والهندسة.

  -----------------------------------------------------------------------
  **Reference**                       **Frontend Architecture
                                      Dependency**
  ----------------------------------- -----------------------------------
  Book 1 --- Enterprise Solution      Defines modular monolith,
  Architecture                        architecture layers, shared kernel
                                      and event-aware platform.

  Book 2 --- Backend Architecture     Defines commands, queries, DTOs,
                                      pipelines, authorization and
                                      backend folder boundaries.

  Book 3 --- Database Technical       Defines data scope, audit, read
  Design                              models, reporting views and
                                      security-scoped data rules.

  Book 4 --- API Technical            Defines REST standards,
  Architecture                        authentication, authorization,
                                      response formats, error contracts
                                      and webhooks.

  Volume 3 --- FTS                    Defines ERP screens, fields,
                                      workflows, permissions,
                                      validations, reports and
                                      module-level behavior.
  -----------------------------------------------------------------------

# **5.1 Frontend Architecture Vision**

## **5.1.1 Frontend Mission**

The frontend is not a passive presentation layer. In an enterprise ERP
platform, it is the role-based productivity environment where users
execute transactions, approve workflows, analyze exceptions, inspect
audit history, manage documents and interact with operational controls.
It must translate complex ERP behavior into a disciplined, consistent,
secure and efficient user experience.

Frontend Mission:\
Enterprise Workspace\
Role-Based Productivity Environment\
Transaction Execution Platform\
Workflow Interaction Layer\
Decision Support Layer\
Operational Control Center

Goal:\
Enable enterprise users\
to execute business processes\
with maximum efficiency,\
minimum clicks,\
clear visibility,\
full traceability,\
and secure access.

## **5.1.2 Frontend Design Goals**

  -----------------------------------------------------------------------
  **Goal**                            **Frontend Implementation Meaning**
  ----------------------------------- -----------------------------------
  Productivity                        Reduce clicks, support keyboard
                                      shortcuts, quick actions, saved
                                      filters, role workspaces and bulk
                                      operations.

  Consistency                         Use the same object page, list,
                                      table, workflow, attachment,
                                      timeline and audit patterns across
                                      modules.

  Scalability                         Support thousands of screens
                                      through feature-first modules and
                                      shared component architecture.

  Maintainability                     Keep UI, state, routes, services
                                      and feature modules separated and
                                      testable.

  Extensibility                       Enable new ERP modules, reports and
                                      screens without breaking shell,
                                      navigation or core components.

  Responsiveness                      Provide desktop, tablet, mobile and
                                      optional offline-friendly layouts.

  Security                            Render UI actions based on
                                      permissions, but never rely on
                                      frontend authorization alone.

  Accessibility                       Follow WCAG 2.1 AA-oriented
                                      patterns for tables, forms, focus,
                                      keyboard, contrast and screen
                                      reader labels.

  Offline Capability                  Support selected offline flows such
                                      as lookups, recent documents, field
                                      operations and queued actions.

  Performance                         Fast navigation, lazy-loaded
                                      features, virtualized lists,
                                      optimized lookups and cached
                                      reference data.
  -----------------------------------------------------------------------

## **5.1.3 Platform Strategy**

The frontend platform is Flutter. Flutter is selected to provide a
unified UI engineering model across Web, Desktop, Tablet and Mobile
while sharing design tokens, components, routing concepts, state
management, localization, validations and test strategies.

  -----------------------------------------------------------------------
  **Target**                          **Frontend Requirement**
  ----------------------------------- -----------------------------------
  Web                                 Full ERP productivity interface
                                      with desktop-class navigation,
                                      tables, reports and dashboards.

  Desktop                             Dense operational workflows, large
                                      screens, keyboard navigation and
                                      multi-panel layouts.

  Tablet                              Adaptive field operations,
                                      approvals, warehouse/field-service
                                      screens and manager review flows.

  Mobile                              Focused tasks, approvals,
                                      notifications, scanning, quick
                                      create, status review and
                                      offline-friendly workflows.
  -----------------------------------------------------------------------

# **5.2 Frontend Architecture Model**

## **5.2.1 High-Level Architecture**

mermaid\
flowchart TB\
UI\[UI Components\]\
Pages\[Pages\]\
Features\[Feature Modules\]\
State\[State Management\]\
Services\[Application Services\]\
API\[API Clients\]\
Backend\[Backend APIs\]\
\
UI \--\> Pages\
Pages \--\> Features\
Features \--\> State\
State \--\> Services\
Services \--\> API\
API \--\> Backend

## **5.2.2 Layer Structure**

  -----------------------------------------------------------------------
  **Layer**                           **Responsibility**
  ----------------------------------- -----------------------------------
  Presentation Layer                  Pages, widgets, components, forms,
                                      tables, navigation and UI states.

  Application Layer                   Frontend use-case orchestration
                                      such as submit form, load list,
                                      approve action and trigger export.

  State Layer                         Riverpod providers/notifiers for
                                      session, feature, form, workflow
                                      and async state.

  Service Layer                       Permission service, navigation
                                      service, validation service, file
                                      service, notification service and
                                      report service.

  API Layer                           Typed API clients, DTO
                                      serialization, response mapping,
                                      error mapping and retry handling.

  Infrastructure Layer                Secure storage, persistent cache,
                                      offline queue, local database/cache
                                      and device services.
  -----------------------------------------------------------------------

# **5.3 Flutter Architecture**

## **5.3.1 Feature-First Architecture**

The frontend must use a feature-first architecture. ERP scale makes a
layer-first global structure difficult to maintain because hundreds of
screens and thousands of widgets become mixed across modules.
Feature-first keeps sales, finance, inventory and HR independent while
still sharing common design components.

Forbidden global structure:\
/screens\
/widgets\
/services\
/models\
\
Approved feature-first structure:\
/features\
/sales\
/inventory\
/finance\
/purchasing\
/hr

  -----------------------------------------------------------------------
  **Architecture Rule\
  **The feature module owns its pages, state, DTO mappings, validators,
  route definitions and tests. Shared widgets live in shared/ui only when
  they are genuinely reusable.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## **5.3.2 Module Structure**

sales\
├─ presentation\
├─ application\
├─ domain\
├─ infrastructure\
├─ widgets\
├─ pages\
├─ state\
├─ routes\
├─ services\
└─ tests

  -----------------------------------------------------------------------
  **Folder**                          **Purpose**
  ----------------------------------- -----------------------------------
  presentation                        Feature pages, screen composition
                                      and feature-specific widgets.

  application                         Frontend use cases, form submit
                                      handlers and screen workflows.

  domain                              Frontend domain models where
                                      needed; must not duplicate backend
                                      business rules.

  infrastructure                      API client implementations,
                                      mappers, local cache adapters.

  widgets                             Feature-specific widgets that
                                      should not be shared globally.

  pages                               Route-level screens such as list
                                      page, form page and detail page.

  state                               Riverpod providers, state
                                      notifiers, async notifiers and
                                      state classes.

  routes                              Feature route definitions and
                                      guards.

  services                            Feature services such as wizard
                                      orchestration or local import
                                      helpers.

  tests                               Widget, state, routing, API mapper
                                      and integration tests.
  -----------------------------------------------------------------------

## **5.3.3 Shared Layer**

shared\
├─ ui\
├─ widgets\
├─ themes\
├─ localization\
├─ services\
├─ helpers\
├─ security\
├─ permissions\
├─ navigation\
└─ error_handling

The shared layer contains stable cross-module assets only. It must not
become a dumping ground for feature-specific logic. Shared components
must be documented, versioned and covered by component tests.

# **5.4 State Management Architecture**

## **5.4.1 State Strategy**

The platform requires enterprise-grade state management that is
scalable, testable, modular, predictable and friendly to asynchronous
workflows. State must support large forms, approval actions, dashboards,
offline queues and long-running background jobs.

State management criteria:\
Scalable\
Testable\
Modular\
Predictable\
Event Driven

## **5.4.2 Recommended Approach**

The recommended frontend state architecture is Riverpod with
StateNotifier, AsyncNotifier, Provider, FutureProvider and
StreamProvider. Riverpod is selected because it supports explicit
dependencies, testability, modular providers, scoped overrides and clean
separation from widget lifecycle.

  -----------------------------------------------------------------------
  **Riverpod Construct**              **Recommended Use**
  ----------------------------------- -----------------------------------
  Provider                            Immutable dependencies, API
                                      clients, configuration and service
                                      access.

  StateNotifierProvider               Complex mutable screen/form state
                                      where explicit actions are
                                      required.

  AsyncNotifierProvider               Asynchronous screen state such as
                                      lists, details, reports and
                                      dashboards.

  FutureProvider                      Simple one-time lookups and
                                      reference data.

  StreamProvider                      Live updates, notifications, job
                                      progress and event-driven screen
                                      updates.
  -----------------------------------------------------------------------

## **5.4.3 State Categories**

  -----------------------------------------------------------------------
  **State Category**      **Examples**            **Ownership**
  ----------------------- ----------------------- -----------------------
  Application State       Current user, current   App shell/shared
                          company, current        providers.
                          branch, permissions,    
                          locale, theme,          
                          settings.               

  Feature State           Sales orders, invoices, Feature provider/state
                          products, employees,    module.
                          projects, stock         
                          transfers.              

  Form State              Draft values,           Form state notifier.
                          validation state, dirty 
                          flag, attachments, line 
                          edits, unsaved changes. 

  Workflow State          Pending approval,       Workflow
                          approval history,       provider/service.
                          available actions,      
                          state transition        
                          metadata.               

  Cache State             Reference data,         Cache service/provider.
                          lookups, user           
                          preferences, recent     
                          documents.              

  Offline State           Queued commands, sync   Offline queue service.
                          status, local drafts    
                          and conflict flags.     
  -----------------------------------------------------------------------

## **5.4.4 State Rules**

-   Business logic must not live inside widgets.

-   API calls must not be executed directly inside UI build methods.

-   Global mutable state is forbidden.

-   Every asynchronous state must expose loading, empty, success and
    error states.

-   Form states must track dirty/clean status for unsaved change
    warnings.

-   State must be recoverable after navigation when business flow
    requires it.

-   Permission changes must invalidate permission-dependent UI state.

# **5.5 Routing Architecture**

## **5.5.1 Routing Strategy**

The application uses declarative routing. Routes are defined per feature
and registered into the app shell through a central route registry.
Route guards enforce authentication, permissions, data scope and
license/module availability before rendering screens.

## **5.5.2 Route Naming Standard**

/sales/orders\
/sales/orders/:id\
/inventory/transfers\
/finance/journal-entries\
/hr/employees

## **5.5.3 Route Permissions**

  --------------------------------------------------------------------------------
  **Route**                      **Required Permission**   **Scope**
  ------------------------------ ------------------------- -----------------------
  /finance/journal-entries       finance.journal.view      Company + branch +
                                                           journal access.

  /finance/journal-entries/:id   finance.journal.read      Document company,
                                                           branch and account
                                                           scope.

  /sales/orders                  sales.order.view          Sales team, company and
                                                           branch scope.

  /inventory/transfers           inventory.transfer.view   Warehouse scope.

  /hr/employees                  hr.employee.view          Department/company
                                                           scope with salary field
                                                           masking.
  --------------------------------------------------------------------------------

## **5.5.4 Route Guard**

Route guard checks:\
Authenticated?\
Authorized?\
Scope Allowed?\
License / Module Enabled?\
Session Valid?\
MFA Required?\
Maintenance Mode Allowed?

# **5.6 Navigation Architecture**

## **5.6.1 Navigation Types**

  -----------------------------------------------------------------------
  **Navigation Type**                 **Purpose**
  ----------------------------------- -----------------------------------
  Sidebar Navigation                  Primary module navigation for
                                      desktop and tablet.

  Workspace Navigation                Role-specific dashboard,
                                      exceptions, approvals and action
                                      queues.

  Breadcrumb Navigation               Shows functional hierarchy and
                                      document context.

  Quick Actions                       Fast access to create, approve,
                                      post, import, export and scan
                                      actions.

  Global Search Navigation            Jump to documents, masters,
                                      reports, settings and help.

  Context Navigation                  Related documents, smart links,
                                      source/target documents and audit
                                      trail.
  -----------------------------------------------------------------------

## **5.6.2 Desktop Navigation**

Desktop layout uses left sidebar, top toolbar, workspace tabs and quick
search. It supports high-density business users who need tables, split
views, keyboard shortcuts and multi-panel decision making.

## **5.6.3 Mobile Navigation**

Mobile layout uses bottom navigation, drawer and floating contextual
actions. Mobile must favor task execution over configuration-heavy
screens. High-risk actions such as posting may require stronger
confirmation and MFA depending policy.

# **5.7 Dependency Injection**

## **5.7.1 DI Strategy**

All services must be injected through providers. Widgets must not
instantiate API clients or infrastructure classes directly.

Forbidden inside widgets:\
new ApiClient()\
new AuthService()\
new StorageAdapter()

## **5.7.2 Registered Services**

  -----------------------------------------------------------------------
  **Service**                         **Purpose**
  ----------------------------------- -----------------------------------
  ApiClient                           HTTP communication and
                                      response/error mapping.

  AuthService                         Login, refresh, logout and session
                                      handling.

  PermissionService                   Permission checks and
                                      permission-based rendering.

  NavigationService                   Route navigation, redirect and
                                      guarded navigation.

  NotificationService                 In-app notifications, badges and
                                      notification center.

  StorageService                      Secure storage, local preferences
                                      and persistent cache.

  ReportService                       Report execution, jobs, export and
                                      status tracking.

  OfflineQueueService                 Store and sync offline/queued
                                      actions.
  -----------------------------------------------------------------------

# **5.8 Theme System**

## **5.8.1 Theme Architecture**

The theme system is token-driven. All colors, typography, spacing,
elevation, radius, density and status styles must be defined as design
tokens rather than hard-coded in widgets.

  -----------------------------------------------------------------------
  **Theme Element**                   **Definition**
  ----------------------------------- -----------------------------------
  Design Tokens                       Central variables for color,
                                      spacing, radius, shadows,
                                      typography and density.

  Theme Definitions                   Light and dark theme mappings.

  Color System                        Brand, neutral, semantic and risk
                                      colors.

  Typography                          Text scale for headings, labels,
                                      body, metadata and tables.

  Spacing                             Consistent spacing scale for forms,
                                      cards, tables and dashboards.

  Elevation                           Subtle layering for dialogs, cards
                                      and panels.

  Status Colors                       Draft, submitted, approved,
                                      rejected, posted, cancelled and
                                      warning states.
  -----------------------------------------------------------------------

## **5.8.2 Theme Modes**

The system supports Light Theme and Dark Theme. Dark theme must not be a
simple color inversion. Financial negative values, warning colors,
status badges and table states must remain accessible and semantically
consistent.

## **5.8.3 Design Tokens**

Primary Color\
Secondary Color\
Error Color\
Success Color\
Warning Color\
Info Color\
Neutral Background\
Surface Color\
Border Color\
Focus Ring Color\
Table Header Color\
Status Draft Color\
Status Posted Color

## **5.8.4 ERP Status Colors**

  -----------------------------------------------------------------------
  **Status**              **Color Usage**         **UI Rule**
  ----------------------- ----------------------- -----------------------
  Draft                   Gray                    Neutral state;
                                                  editable.

  Submitted               Blue                    Awaiting review or
                                                  approval.

  Approved                Green                   Approved but not
                                                  necessarily posted.

  Rejected                Red                     Requires correction or
                                                  resubmission.

  Posted                  Dark Green              Legal/financially
                                                  effective; immutable.

  Cancelled               Dark Gray               Inactive/cancelled;
                                                  read-only.

  Exception               Amber/Warning           Requires user action or
                                                  review.
  -----------------------------------------------------------------------

# **5.9 Localization Architecture**

## **5.9.1 Supported Languages**

The minimum supported languages are Arabic and English. The architecture
must support additional languages without changing screen logic.

## **5.9.2 Localization Scope**

-   UI text and labels.

-   Dates and time.

-   Currency formatting.

-   Number formatting.

-   Validation messages.

-   Error messages.

-   Reports.

-   Notifications.

-   Print templates.

-   Accessibility labels.

## **5.9.3 RTL Support**

Arabic requires full RTL support across layout, tables, forms,
navigation, breadcrumbs, dialogs and report previews. Mixed
Arabic/English content must preserve number and code readability.

  -----------------------------------------------------------------------
  **RTL Area**                        **Requirement**
  ----------------------------------- -----------------------------------
  Forms                               Labels, input alignment and section
                                      order adapt to RTL.

  Tables                              Column order policy must be defined
                                      per screen; numeric columns remain
                                      readable.

  Navigation                          Sidebar and breadcrumbs support RTL
                                      direction.

  Dialogs                             Actions and focus order adapt to
                                      RTL language.

  Reports                             Printed reports must support RTL
                                      fonts and layout.
  -----------------------------------------------------------------------

# **5.10 Responsive Design Strategy**

## **5.10.1 Device Categories**

  -----------------------------------------------------------------------
  **Device Type**         **Width**               **Primary UX Pattern**
  ----------------------- ----------------------- -----------------------
  Mobile                  \< 768 px               Single column,
                                                  task-focused actions,
                                                  simplified tables.

  Tablet                  768--1199 px            Adaptive panels,
                                                  list/detail
                                                  transitions, field
                                                  operations.

  Desktop                 \>= 1200 px             Multi-column forms,
                                                  split views, dense
                                                  tables, workspace
                                                  dashboards.
  -----------------------------------------------------------------------

## **5.10.2 Layout Strategy**

  -----------------------------------------------------------------------
  **Layout**                          **Description**
  ----------------------------------- -----------------------------------
  Mobile                              Single column; cards replace dense
                                      tables; bottom actions; reduced
                                      configuration screens.

  Tablet                              Adaptive layout; collapsible
                                      panels; larger touch targets;
                                      optional split view.

  Desktop                             Multi-workspace layout; sidebar;
                                      large tables; master-detail; docked
                                      panels.
  -----------------------------------------------------------------------

## **5.10.3 ERP Workspace Mode**

-   Master-detail screens for orders, invoices, employees and stock
    transfers.

-   Side panels for audit, attachments, comments and related documents.

-   Split views for review/approval and reconciliation workflows.

-   Docked reports for finance and inventory analysis.

# **5.11 Offline Architecture**

## **5.11.1 Offline Goals**

Offline support is selective and controlled. It is intended for weak,
intermittent or temporary offline conditions, not for permanent offline
ERP operation. Offline transactions must be queued, validated locally
where possible and revalidated by backend during sync.

## **5.11.2 Cached Data**

Lookups\
Currencies\
Permissions\
User Preferences\
Recent Documents\
Warehouse Locations\
Product Barcodes\
Open Assigned Tasks

## **5.11.3 Offline Queue**

The offline queue stores create/update commands, attachments and user
actions until synchronization. Each queued item requires local ID,
command type, payload, timestamp, user, company, retry count and sync
status.

  -----------------------------------------------------------------------
  **Offline Queue Field**             **Purpose**
  ----------------------------------- -----------------------------------
  local_id                            Temporary client-side identifier.

  command_type                        Business action type such as
                                      CreateStockCountLine.

  payload                             Serialized command payload.

  created_at                          Offline creation timestamp.

  user_id                             Actor who created the command.

  company_id                          Company context.

  retry_count                         Sync retry count.

  sync_status                         Pending, syncing, failed, synced or
                                      conflict.
  -----------------------------------------------------------------------

## **5.11.4 Conflict Resolution**

  -----------------------------------------------------------------------
  **Conflict Strategy**               **Use Case**
  ----------------------------------- -----------------------------------
  Server Wins                         Financial postings, posted
                                      documents, security-sensitive data.

  Client Wins                         Limited low-risk drafts when no
                                      server update occurred.

  Manual Resolution                   Conflicting field edits, stock
                                      counts, field service notes and
                                      attachments.
  -----------------------------------------------------------------------

# **5.12 Caching Architecture**

## **5.12.1 Cache Layers**

  -----------------------------------------------------------------------
  **Cache Layer**                     **Purpose**
  ----------------------------------- -----------------------------------
  In-Memory Cache                     Short-lived screen/reference data
                                      during app session.

  Persistent Cache                    Lookups, user preferences and
                                      recent documents across sessions.

  Offline Cache                       Approved offline datasets and
                                      queued actions.
  -----------------------------------------------------------------------

## **5.12.2 Cached Entities**

Companies\
Branches\
Currencies\
Permissions\
Lookups\
Countries\
Payment Terms\
Warehouses\
UOMs\
Reason Codes

## **5.12.3 Cache Invalidation**

  -----------------------------------------------------------------------
  **Invalidation Trigger**            **Action**
  ----------------------------------- -----------------------------------
  Login                               Refresh user, company, permission
                                      and config cache.

  Permission Change                   Invalidate permission-dependent
                                      routes and UI actions.

  Workflow Change                     Refresh available actions and
                                      status metadata.

  Configuration Change                Refresh settings, sequences and
                                      posting/approval rules.

  New App Version                     Clear incompatible persistent
                                      caches.
  -----------------------------------------------------------------------

# **5.13 Component Hierarchy**

## **5.13.1 Hierarchy**

App\
→ Workspace\
→ Feature\
→ Page\
→ Section\
→ Component\
→ Widget

## **5.13.2 Component Categories**

  -----------------------------------------------------------------------
  **Category**                        **Examples**
  ----------------------------------- -----------------------------------
  Layout Components                   App shell, sidebar, top bar,
                                      responsive grid, split view.

  Form Components                     Text field, lookup, date picker,
                                      currency field, line items grid.

  Table Components                    Data table, tree table, editable
                                      grid, totals row, column manager.

  Workflow Components                 Status bar, approval panel, action
                                      toolbar, audit timeline.

  Navigation Components               Breadcrumbs, quick actions, global
                                      search, favorites.

  Feedback Components                 Toast, alert banner, loading
                                      skeleton, error summary, empty
                                      state.
  -----------------------------------------------------------------------

# **5.14 Error Handling Architecture**

## **5.14.1 Error Categories**

  -----------------------------------------------------------------------
  **Error Category**                  **Frontend Handling**
  ----------------------------------- -----------------------------------
  Validation                          Inline field errors and form-level
                                      error summary.

  Authorization                       Access denied page or disabled
                                      action with reason.

  Network                             Retry option, offline indicator and
                                      queued action when supported.

  Business Rule                       Business message with recovery
                                      guidance.

  Workflow                            Action restricted message and
                                      available next actions.

  System                              Error dialog with correlation ID
                                      and support guidance.
  -----------------------------------------------------------------------

## **5.14.2 API Error Mapping**

Backend:\
{\
\"code\":\"FIN-POST-001\"\
}\
\
Frontend:\
Financial Period Closed

## **5.14.3 Global Error Handler**

Handles:\
401 Unauthorized\
403 Forbidden\
500 Internal Server Error\
Timeout\
Connectivity failure\
Session expired\
Maintenance mode\
Version mismatch

# **5.15 Frontend Performance Architecture**

## **5.15.1 Performance Targets**

  -----------------------------------------------------------------------
  **Action**                          **Target**
  ----------------------------------- -----------------------------------
  Login                               \< 2 seconds after network
                                      response.

  Workspace Load                      \< 3 seconds for normal role scope.

  Form Open                           \< 1 second for cached metadata.

  Lookup Load                         \< 500 ms for cached/common
                                      lookups.

  Navigation                          \< 200 ms route transition after
                                      bundle loaded.

  List Scroll                         No visible frame drops for
                                      virtualized list.
  -----------------------------------------------------------------------

## **5.15.2 Lazy Loading**

Feature modules, pages, reports, dashboards and large dependencies must
be lazy-loaded. Users should not download or initialize every ERP module
on first login.

## **5.15.3 Virtualized Lists**

High-volume ERP lists must use pagination, infinite scroll or
virtualized rendering. Journal entries, stock moves, customers,
products, audit events and approval inboxes must never render unbounded
row sets.

Apply virtualization to:\
Journal Entries\
Stock Moves\
Customers\
Products\
Audit Events\
Approval Inbox\
Inventory Lots/Serials

# **5.16 Accessibility Architecture**

## **5.16.1 Standards**

The frontend follows WCAG 2.1 AA-oriented design. Accessibility is
mandatory for forms, approvals, tables, reports and navigation.
Accessibility testing must be part of QA, not a final cosmetic review.

## **5.16.2 Accessibility Controls**

-   Keyboard navigation.

-   Screen reader labels.

-   Focus management.

-   Color contrast.

-   Large text support.

-   Non-color status indicators.

-   Accessible error summaries.

-   Table header semantics.

-   Dialog focus trapping.

-   Skip navigation where appropriate.

## **5.16.3 ERP Accessibility Requirements**

  -----------------------------------------------------------------------
  **Area**                            **Requirement**
  ----------------------------------- -----------------------------------
  Forms                               Labels, required markers, inline
                                      errors and keyboard traversal.

  Approvals                           Action buttons accessible by
                                      keyboard and screen reader.

  Tables                              Headers, sorting labels, row focus
                                      and keyboard navigation.

  Reports                             Readable charts, data table
                                      alternative and export
                                      accessibility.

  Notifications                       Announced alerts with appropriate
                                      urgency.
  -----------------------------------------------------------------------

# **5.17 Security on Frontend**

## **5.17.1 Frontend Security Rules**

Forbidden:\
Store JWT in insecure storage\
Client-side authorization only\
Expose hidden fields in API responses\
Hard-code secrets\
Trust route guards as the only security layer\
Log sensitive personal/financial data

## **5.17.2 Required Security Controls**

Secure Storage\
Refresh Tokens\
Permission-Based Rendering\
Mask Sensitive Data\
Session Timeouts\
Route Guards\
Sensitive Action Confirmation\
MFA hooks for high-risk actions\
Export Permission Checks

## **5.17.3 Permission-Based Rendering**

The UI must hide or disable actions based on permission metadata, but
backend remains the final authority. Buttons disabled due to permission
or workflow state should provide a short reason when appropriate,
especially for enterprise users and approvers.

# **5.18 Frontend Folder Structure**

src\
├─ app\
│ ├─ app_shell.dart\
│ ├─ app_router.dart\
│ └─ app_bootstrap.dart\
├─ shared\
│ ├─ ui\
│ ├─ widgets\
│ ├─ themes\
│ ├─ localization\
│ ├─ services\
│ ├─ helpers\
│ ├─ security\
│ ├─ permissions\
│ ├─ navigation\
│ └─ error_handling\
├─ core\
│ ├─ api\
│ ├─ auth\
│ ├─ config\
│ ├─ cache\
│ ├─ offline\
│ └─ observability\
├─ features\
│ ├─ sales\
│ ├─ inventory\
│ ├─ finance\
│ ├─ purchasing\
│ ├─ hr\
│ └─ projects\
├─ localization\
├─ themes\
├─ services\
└─ tests

  -----------------------------------------------------------------------
  **Folder**                          **Rule**
  ----------------------------------- -----------------------------------
  app                                 Application shell, top-level
                                      routing and bootstrap only.

  shared                              Reusable components and
                                      cross-cutting frontend utilities.

  core                                Infrastructure-level frontend
                                      concerns such as API, auth, cache
                                      and offline.

  features                            All ERP module-specific pages,
                                      state, services and tests.

  localization                        Translation assets and localization
                                      helpers.

  themes                              Design tokens and theme
                                      definitions.

  tests                               Cross-feature and shared test
                                      utilities.
  -----------------------------------------------------------------------

# **5.19 Testing Strategy**

## **5.19.1 Mandatory Tests**

  -----------------------------------------------------------------------
  **Test Type**                       **Purpose**
  ----------------------------------- -----------------------------------
  Widget Tests                        Validate reusable components and
                                      feature widgets.

  Integration Tests                   Validate screen flows with mocked
                                      APIs or test backend.

  Golden Tests                        Validate visual consistency for key
                                      components and screens.

  Routing Tests                       Validate guarded routes, redirects
                                      and deep links.

  Permission Tests                    Validate hidden/disabled actions
                                      and field masking.

  Localization Tests                  Validate Arabic/English text, RTL,
                                      dates, numbers and currencies.

  Performance Tests                   Validate large tables, navigation
                                      speed and workspace load behavior.

  Accessibility Tests                 Validate focus, labels, keyboard
                                      operation and contrast.
  -----------------------------------------------------------------------

## **5.19.2 Critical Test Scenarios**

-   User without permission cannot see restricted menu item.

-   User with read-only permission cannot edit form fields.

-   Posted document opens in read-only state.

-   Salary field is masked for unauthorized HR users.

-   Arabic RTL route renders without layout break.

-   Offline queued stock count syncs successfully or shows conflict.

-   Large journal entry list remains responsive with
    pagination/virtualization.

-   Global error handler shows correlation ID for server errors.

# **5.20 Frontend Readiness Matrix**

  -----------------------------------------------------------------------
  **Area**                **Status**              **Readiness Criteria**
  ----------------------- ----------------------- -----------------------
  Flutter Architecture    Complete                Feature-first
                                                  structure, shared
                                                  layer, app shell and
                                                  route registry defined.

  State Management        Complete                Riverpod
                                                  providers/notifiers and
                                                  state categories
                                                  defined.

  Routing                 Complete                Declarative routes,
                                                  guards and permissions
                                                  defined.

  Navigation              Complete                Desktop, tablet,
                                                  mobile, search and
                                                  contextual navigation
                                                  defined.

  Dependency Injection    Complete                Services injected
                                                  through providers; no
                                                  direct service
                                                  construction in
                                                  widgets.

  Theme System            Complete                Tokens, light/dark
                                                  themes and status
                                                  colors defined.

  Localization            Complete                Arabic/English, RTL,
                                                  formatting and
                                                  localized errors
                                                  defined.

  Responsive Design       Complete                Mobile/tablet/desktop
                                                  patterns defined.

  Offline Mode            Complete                Selective offline
                                                  cache, queue and
                                                  conflict resolution
                                                  defined.

  Caching                 Complete                In-memory, persistent
                                                  and offline cache rules
                                                  defined.

  Components              Complete                Hierarchy and component
                                                  categories defined.

  Error Handling          Complete                Error categories and
                                                  API mapping defined.

  Performance             Complete                Targets, lazy loading
                                                  and virtualization
                                                  defined.

  Accessibility           Complete                WCAG-oriented controls
                                                  and ERP accessibility
                                                  requirements defined.

  Security                Complete                Secure storage,
                                                  permission rendering
                                                  and sensitive data
                                                  rules defined.

  Testing                 Complete                Mandatory tests and
                                                  critical scenarios
                                                  defined.
  -----------------------------------------------------------------------

# **5.21 Completion Status**

## **5.21.1 Book 5 Completion Checklist**

  -----------------------------------------------------------------------
  **Requirement**                     **Covered**
  ----------------------------------- -----------------------------------
  Flutter Architecture                Yes

  State Management                    Yes

  Routing                             Yes

  Navigation                          Yes

  Dependency Injection                Yes

  Theme System                        Yes

  Localization                        Yes

  Responsive Strategy                 Yes

  Offline Strategy                    Yes

  Caching                             Yes

  Component Hierarchy                 Yes

  Folder Structure                    Yes

  Code Organization                   Yes

  Feature Modules                     Yes

  Error Handling                      Yes

  Performance                         Yes

  Accessibility                       Yes

  Security                            Yes

  Testing                             Yes
  -----------------------------------------------------------------------

## **5.21.2 Cross-Reference Matrix**

  -----------------------------------------------------------------------
  **Book 5 Section**                  **Related Volume / Book**
  ----------------------------------- -----------------------------------
  Frontend architecture vision        Book 1 Architecture Vision and
                                      Volume 2 UI strategy.

  API clients and error mapping       Book 4 API Technical Architecture.

  State and workflows                 Volume 3 FTS workflows and Book 2
                                      command/query architecture.

  Permission-based rendering          Volume 3 Permission Matrix and Book
                                      7 Security Architecture later.

  Offline and caching                 Book 8 Performance Architecture
                                      later.

  Folder structure and testing        Book 10 Engineering Standards
                                      later.

  Screens and components              Volume 3 FTS screen specifications
                                      and Book 6 UI Component Library
                                      next.
  -----------------------------------------------------------------------

## **5.21.3 Remaining Books**

-   Book 6 --- UI Component Library

-   Book 7 --- Security Architecture

-   Book 8 --- Performance Architecture

-   Book 9 --- DevOps Architecture

-   Book 10 --- Engineering Standards

-   Book 11 --- Architecture Decision Records ADR

-   Book 12 --- Implementation Readiness Assessment

**BOOK 5 --- Frontend Architecture: Completed.**
