**Volume 4 --- SDTA**

**BOOK 2 --- Backend Architecture**

Enterprise ERP Solution Design & Technical Architecture

Implementation-ready backend engineering reference after Book 1

Prepared for: Abdullah Maresh \| Date: 07 July 2026

# **Document Context and Consistency Statement**

This document implements BOOK 2 --- Backend Architecture according to
the approved Volume 4 SDTA Master TOC. It builds directly on BOOK 1 ---
Enterprise Solution Architecture and preserves the decisions established
in Volumes 1--3. It does not re-benchmark vendors, redesign the
platform, or duplicate functional module specifications. It defines the
engineering structure for implementing backend services, domain logic,
application use cases, repositories, transactions, events, caching,
jobs, queues, exceptions, logging, auditing, dependency injection,
concurrency, folder structure, naming conventions and coding guidelines.

تم إعداد هذا الملف كوثيقة Word مستقلة ومنسقة لفريق Backend والهندسة،
بحيث تكون قابلة للتنفيذ المباشر ومفهومة ومنظمة.

  -----------------------------------------------------------------------
  **Reference**                       **Role in Book 2**
  ----------------------------------- -----------------------------------
  Book 1 --- Enterprise Solution      Defines modular monolith, shared
  Architecture                        kernel, event architecture and
                                      architecture layers.

  Volume 2 --- Software Blueprint     Defines domain-oriented,
                                      event-aware, audit-first
                                      architecture and engineering
                                      standards.

  Volume 3 --- FTS                    Defines module-level commands,
                                      screens, documents, rules,
                                      workflows, APIs and posting
                                      behavior.

  Book 2 --- Backend Architecture     Defines backend implementation
                                      patterns and coding structure.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Backend Architecture Rule\
  **Backend is responsible for enforcing business correctness. Frontend
  and external integrations must never bypass backend application/domain
  rules.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

# **2.1 Backend Architecture Overview**

## **2.1.1 Backend Responsibility**

The backend layer is responsible for executing enterprise business
logic, not only exposing APIs. It receives user and integration
requests, applies permission and policy checks, executes use cases,
coordinates workflows, performs posting orchestration, persists state,
emits events, writes audit trails, runs background jobs and provides
secure query models for frontend and reporting consumers.

-   Receive commands and queries from the API layer.

-   Execute business use cases and module-specific application logic.

-   Apply authorization, data scope, field scope and
    segregation-of-duties policies.

-   Manage document lifecycle and workflow transitions.

-   Execute business rules and validations consistently.

-   Coordinate accounting posting and inventory posting through shared
    services.

-   Create domain events and integration events.

-   Persist aggregate state through repositories and unit of work.

-   Record audit events for critical actions.

-   Run background jobs, integration jobs and event publishing workers.

## **2.1.2 Backend Boundary**

The backend boundary protects the system from architectural leakage. UI,
integrations and reports must not directly modify operational data.
Controllers must not contain business logic, posting logic or workflow
decisions.

  -----------------------------------------------------------------------
  **Allowed in Backend**              **Forbidden in Backend Boundary**
  ----------------------------------- -----------------------------------
  Application use cases,              UI visual layout logic or component
  command/query handlers, domain      rendering logic.
  services, repositories and          
  infrastructure adapters.            

  Business rules, workflows, posting  Direct database writes from
  orchestration, audit and            frontend or external systems.
  authorization.                      

  DTO mapping, validation pipeline,   SQL scattered inside controllers or
  transaction pipeline and event      external clients.
  publishing.                         

  Controlled read models and query    Business validation that exists
  services.                           only in frontend.
  -----------------------------------------------------------------------

Correct flow:\
Frontend → API Controller → Application Layer → Domain Layer →
Infrastructure\
\
Forbidden flow:\
Frontend → Database\
External Integration → Database\
Controller → SQL → Posting tables

## **2.1.3 Backend Design Goals**

  -----------------------------------------------------------------------
  **Goal**                            **Backend Meaning**
  ----------------------------------- -----------------------------------
  Domain Integrity                    Every state-changing operation
                                      passes through the correct
                                      aggregate, domain service or
                                      policy.

  Posting Safety                      No accounting or inventory posting
                                      occurs outside the approved posting
                                      services.

  Workflow Consistency                Every state transition goes through
                                      workflow service and is
                                      audit-logged.

  Security Enforcement                Every command and query evaluates
                                      permissions, scopes and field-level
                                      security.

  Auditability                        Every critical action produces
                                      traceable audit evidence.

  Testability                         Every rule, policy, use case,
                                      posting and workflow is testable in
                                      isolation and integration.

  Maintainability                     Commands, queries, domain logic and
                                      infrastructure are separated.

  Scalability                         Heavy side effects run
                                      asynchronously through queues and
                                      workers when appropriate.

  Integration Safety                  External calls use idempotency
                                      keys, correlation IDs, retries and
                                      error mapping.
  -----------------------------------------------------------------------

## **2.1.4 Backend Non-Goals**

-   Implementing financial or inventory business logic inside stored
    procedures as a substitute for the domain layer.

-   Allowing frontend to bypass workflow, authorization or posting
    services.

-   Making every module an independent microservice from the first
    release.

-   Duplicating authorization logic separately inside every module.

-   Executing heavy analytics directly through transactional queries
    when read models are required.

# **2.2 Application Layers**

## **2.2.1 Backend Layer Model**

mermaid\
flowchart TB\
API\[API Controllers\]\
App\[Application Layer\]\
Domain\[Domain Layer\]\
Infra\[Infrastructure Layer\]\
DB\[(Database)\]\
Cache\[(Cache)\]\
Queue\[(Queue)\]\
External\[External Integrations\]\
\
API \--\> App\
App \--\> Domain\
Domain \--\> Infra\
Infra \--\> DB\
Infra \--\> Cache\
Infra \--\> Queue\
Infra \--\> External

## **2.2.2 Presentation / API Controllers**

API Controllers are thin entry points. They receive HTTP requests,
extract execution context, call mediator/handlers and return
standardized responses. They must not implement decisions that belong to
application or domain layers.

Controller must not:\
- Access database directly\
- Build journal entries directly\
- Change document status directly\
- Send notifications directly\
- Apply approval logic directly

## **2.2.3 Application Services**

The application layer represents use cases. It coordinates the execution
of commands and queries according to the domain model, workflow engine,
posting engine, audit service and outbox/event architecture.

Examples:\
ConfirmSalesOrderCommandHandler\
PostCustomerInvoiceCommandHandler\
ValidateGoodsReceiptCommandHandler\
ApprovePurchaseOrderCommandHandler\
RunPayrollCommandHandler\
CloseFiscalPeriodCommandHandler

-   Orchestrate use case execution.

-   Load aggregates and required data.

-   Call domain behavior and policies.

-   Open and control transaction boundaries.

-   Call workflow service where state transition is needed.

-   Call posting service if financial or inventory posting is required.

-   Save changes through unit of work.

-   Record audit events and save outbox events.

## **2.2.4 Domain Services**

  -----------------------------------------------------------------------
  **Domain Service**                  **Responsibility**
  ----------------------------------- -----------------------------------
  PricingService                      Calculate price, discount,
                                      commercial tax basis and applicable
                                      pricing conditions.

  CreditCheckService                  Evaluate customer credit limit,
                                      exposure and credit block status.

  AvailabilityService                 Check available stock, reservations
                                      and warehouse availability rules.

  PostingPreparationService           Prepare posting data before sending
                                      to central posting engine.

  InventoryValuationService           Calculate inventory cost and
                                      valuation layers.

  PayrollCalculationService           Calculate gross pay, deductions,
                                      employer liabilities and net pay.

  BudgetControlService                Evaluate budget availability and
                                      commitment rules.

  MatchingService                     Match purchase order, goods receipt
                                      and vendor bill.
  -----------------------------------------------------------------------

## **2.2.5 Infrastructure Services**

Infrastructure services implement technical details and external access.
They are called through interfaces from application/domain layers and
must be replaceable for testing and future provider changes.

-   ORM and relational database persistence.

-   Repositories and query services.

-   Redis or distributed cache.

-   Message queue and outbox publisher.

-   External API clients.

-   File/object storage.

-   Email/SMS/push providers.

-   PDF, import and export adapters.

## **2.2.6 Background Workers**

-   Publish outbox events.

-   Send notifications.

-   Generate heavy reports.

-   Run scheduled jobs.

-   Synchronize external systems.

-   Process imports and exports.

-   Execute retries and dead-letter handling.

-   Process long-running integration jobs.

## **2.2.7 Integration Adapters**

BankIntegrationAdapter\
TaxAuthorityAdapter\
ShippingProviderAdapter\
PaymentGatewayAdapter\
EInvoicingAdapter\
IdentityProviderAdapter\
EmailProviderAdapter

Every adapter must implement timeout, retry, circuit breaker,
correlation ID propagation, secure secret handling, request/response
logging with masking and deterministic error mapping.

# **2.3 Domain Layer**

## **2.3.1 Entities**

An entity has identity and lifecycle. It protects its own invariants and
exposes business methods, but it does not access the database, call
external services or know about the UI/API.

Examples:\
Customer\
Supplier\
Product\
SalesOrder\
PurchaseOrder\
JournalEntry\
StockMove\
ProductionOrder\
Employee\
Project\
Asset\
\
Business methods:\
SalesOrder.confirm()\
SalesOrder.cancel(reason)\
PurchaseOrder.approve(approver)\
JournalEntry.post()\
StockTransfer.validate()

-   Entity must not depend on database directly.

-   Entity must not call external services.

-   Entity must protect its own invariants.

-   Entity methods must represent business actions, not data setters
    only.

## **2.3.2 Aggregate Roots**

  -----------------------------------------------------------------------
  **Aggregate Root**                  **Child Entities**
  ----------------------------------- -----------------------------------
  SalesOrder                          SalesOrderLine, Discount,
                                      DeliveryInstruction

  PurchaseOrder                       PurchaseOrderLine, SupplierTerms

  JournalEntry                        JournalEntryLine, TaxLine

  StockTransfer                       StockMoveLine, Lot/Serial
                                      Assignment

  ProductionOrder                     WorkOrder, ConsumptionLine,
                                      FinishedGoodsLine

  PayrollRun                          Payslip, PayslipLine
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
  **Aggregate Rule\
  **Child entities must never be modified directly from outside the
  aggregate root. All consistency-sensitive changes go through the
  aggregate root.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

## **2.3.3 Value Objects**

Money\
CurrencyAmount\
Quantity\
Percentage\
TaxRate\
Address\
PostingDate\
FiscalPeriod\
DocumentNumber\
LotNumber\
SerialNumber

-   Immutable.

-   Validated at creation.

-   No database identity.

-   Compared by value.

-   Used to prevent invalid primitive values from leaking into domain
    logic.

## **2.3.4 Domain Events**

SalesOrderConfirmed\
PurchaseOrderApproved\
CustomerInvoicePosted\
StockMoveValidated\
ProductionOrderReleased\
PayrollPosted\
PermissionChanged

-   Use past-tense business language.

-   Include correlation_id.

-   Include source document information.

-   Avoid unnecessary sensitive data.

-   Support versioning and schema registry.

## **2.3.5 Policies**

  -----------------------------------------------------------------------
  **Policy**                          **Purpose**
  ----------------------------------- -----------------------------------
  CanConfirmSalesOrderPolicy          Checks credit, discount, customer
                                      status and order validity.

  CanPostJournalEntryPolicy           Checks balance, period, permissions
                                      and posting readiness.

  CanValidateStockMovePolicy          Checks stock, lot/serial and
                                      warehouse scope.

  CanApprovePurchaseOrderPolicy       Checks amount, role, approval limit
                                      and SOD.

  CanRunPayrollPolicy                 Checks payroll period, exceptions,
                                      approvals and payroll readiness.
  -----------------------------------------------------------------------

## **2.3.6 Specifications**

IsCustomerActive\
IsPeriodOpen\
HasSufficientStock\
IsSupplierApproved\
IsDiscountWithinLimit\
IsLotNotExpired\
IsUserInCompanyScope

Specifications are reusable predicates used by policies, validators and
domain services. They must be deterministic and testable.

## **2.3.7 Factories**

SalesOrderFactory.createFromQuotation()\
PurchaseOrderFactory.createFromRFQ()\
JournalEntryFactory.createFromInvoice()\
StockMoveFactory.createFromDelivery()\
PayrollRunFactory.createForPeriod()

Factories are required when aggregate creation depends on defaults,
numbering, inherited values, source document linkage, derived lines,
initial workflow state or configuration-based initialization.

# **2.4 Application Layer**

## **2.4.1 Commands**

CreateSalesOrderCommand\
ConfirmSalesOrderCommand\
ApprovePurchaseOrderCommand\
ValidateGoodsReceiptCommand\
PostCustomerInvoiceCommand\
ReverseJournalEntryCommand\
RunPayrollCommand\
CloseFiscalPeriodCommand

A command represents an intention to change system state. Commands are
handled once, audited, authorized and validated. Commands that post,
integrate or create documents from external sources must support
idempotency.

Mandatory command envelope:\
command_id\
correlation_id\
user_context\
company_id\
payload\
idempotency_key, if external or posting-related

## **2.4.2 Command Handlers**

mermaid\
sequenceDiagram\
participant API\
participant Handler\
participant Auth\
participant Repo\
participant Domain\
participant Workflow\
participant Posting\
participant Audit\
participant Outbox\
\
API-\>\>Handler: Command\
Handler-\>\>Auth: Authorize\
Handler-\>\>Repo: Load Aggregate\
Handler-\>\>Domain: Execute Business Logic\
Handler-\>\>Workflow: Apply State Transition\
Handler-\>\>Posting: Post if required\
Handler-\>\>Audit: Record Audit\
Handler-\>\>Outbox: Save Events\
Handler-\>\>Repo: Commit

## **2.4.3 Queries**

GetSalesOrderByIdQuery\
SearchCustomersQuery\
GetStockOnHandQuery\
GetTrialBalanceQuery\
GetPendingApprovalsQuery\
GetAuditTimelineQuery

-   Queries do not change state.

-   Queries enforce data scope security.

-   Queries support pagination, filtering, sorting and searching.

-   Queries must not reveal masked or forbidden fields.

-   Sensitive queries may create audit events.

## **2.4.4 DTOs**

  -----------------------------------------------------------------------
  **DTO Type**                        **Purpose**
  ----------------------------------- -----------------------------------
  Request DTO                         Input contract received from API
                                      consumer.

  Response DTO                        Output contract returned to
                                      consumer.

  List Item DTO                       Optimized row for list pages.

  Detail DTO                          Full object page data.

  Lookup DTO                          Small dataset for
                                      dropdowns/lookups.

  Command DTO                         Maps API request to command.

  Import DTO                          Validated import row structure.

  Export DTO                          Controlled export representation.
  -----------------------------------------------------------------------

-   Do not expose domain entities directly as API responses.

-   Mask or remove sensitive fields.

-   Use ISO 8601 timestamps.

-   Represent money as amount + currency.

-   Avoid exposing internal database implementation details.

## **2.4.5 Use Cases**

Every use case must document:\
Name\
Command / Query\
Actor\
Permission\
Input DTO\
Output DTO\
Aggregate\
Policies\
Transaction Boundary\
Events\
Audit\
Errors\
Tests

## **2.4.6 Validation Pipeline**

  -----------------------------------------------------------------------
  **Validation Level**                **Example**
  ----------------------------------- -----------------------------------
  DTO Validation                      Required fields, type, length and
                                      format.

  Business Validation                 Customer active, supplier approved,
                                      product sellable.

  Workflow Validation                 Action allowed in current state.

  Posting Validation                  Balanced journal, open period,
                                      valid accounts.

  Security Validation                 Permission, scope and field access.

  Integration Validation              Idempotency key and external
                                      reference validity.
  -----------------------------------------------------------------------

## **2.4.7 Authorization Pipeline**

Authentication → Role Permission → Data Scope → Field Scope → Workflow
Permission → SOD Check → Policy Check

## **2.4.8 Transaction Pipeline**

The transaction boundary covers aggregate modifications, ledger
postings, workflow state changes, audit records and outbox events. It
must not include email sending, webhook calls, heavy PDF generation or
BI projection updates. These are executed after commit through workers.

## **2.4.9 Audit Pipeline**

user_id\
company_id\
module\
document_type\
document_id\
action\
old_state\
new_state\
request_payload_hash\
ip_address\
device\
correlation_id\
timestamp

# **2.5 Infrastructure Layer**

## **2.5.1 Database Access**

Application Handler → Repository / Query Service → ORM / SQL → Database

Controllers, frontend clients and external integrations must not access
the database directly. All persistence must pass through approved
repository/query/service boundaries.

## **2.5.2 ORM Strategy**

The ORM should be used for aggregates, transactional entities, master
data and configuration where object mapping improves maintainability.
Heavy reports may use optimized SQL, read models, materialized views or
a reporting store.

## **2.5.3 Repository Implementation**

  -----------------------------------------------------------------------
  **Repository Type**                 **Purpose**
  ----------------------------------- -----------------------------------
  Aggregate Repository                Load and save aggregate roots.

  Read Repository                     Optimized query reads and
                                      list/detail projections.

  Lookup Repository                   Lightweight dropdown and reference
                                      data queries.

  Posting Repository                  Persist ledger and posting records.

  Audit Repository                    Persist and query audit events.

  Configuration Repository            Access versioned settings and
                                      rules.
  -----------------------------------------------------------------------

## **2.5.4 Unit of Work**

The Unit of Work coordinates transaction lifecycle. It opens the
transaction, tracks changes, commits, rolls back and saves outbox events
inside the same transaction.

Commit Rule:\
No external side effect before successful commit.

## **2.5.5 Distributed Cache**

  -----------------------------------------------------------------------
  **Cache Use**                       **Allowed? / Rule**
  ----------------------------------- -----------------------------------
  Permissions cache                   Allowed; must invalidate after
                                      role/permission changes.

  Reference data cache                Allowed for stable data such as
                                      currencies and UOMs.

  Configuration cache                 Allowed with version-aware
                                      invalidation.

  Session metadata                    Allowed; sensitive tokens follow
                                      security rules.

  Idempotency keys                    Allowed with expiry and unique
                                      constraints.

  Posted ledger source of truth       Forbidden; ledger is database
                                      source of truth.

  Critical financial state            Forbidden as cache-only source.
  -----------------------------------------------------------------------

## **2.5.6 File Storage**

-   Store file metadata in the database and binary content in object
    storage.

-   Scan files before making them available.

-   Apply document permission checks to attachments.

-   Use immutable or versioned attachments for posted legal documents.

-   Log upload, download and delete events with audit.

## **2.5.7 External API Clients**

Every external API client must support:\
timeout\
retry\
circuit breaker\
request logging\
response logging\
masked secrets\
correlation ID\
error mapping

# **2.6 Repository Pattern**

## **2.6.1 Repository Responsibility**

Repositories do not contain business logic. They load aggregates, save
aggregate state, execute persistence operations and enforce
persistence-level constraints only.

## **2.6.2 Aggregate Repository Rules**

Allowed:\
SalesOrderRepository.getById()\
SalesOrderRepository.save()\
PurchaseOrderRepository.getById()\
JournalEntryRepository.save()\
\
Forbidden in repository:\
approveOrder()\
calculateTax()\
postInvoice()

## **2.6.3 Read Repository Rules**

SalesOrderReadRepository.search()\
StockOnHandReadRepository.getByWarehouse()\
TrialBalanceReadRepository.run()

Read repositories may use optimized SQL/read models, but must still
enforce authorization and data scope rules.

## **2.6.4 Repository Anti-Patterns**

-   God repository combining unrelated modules.

-   Repository per table without domain meaning.

-   SQL inside controller.

-   Business decisions inside repository.

-   Bypassing unit of work.

# **2.7 Unit of Work**

  -----------------------------------------------------------------------
  **Topic**                           **Rule**
  ----------------------------------- -----------------------------------
  Transaction Scope                   Aggregate update, workflow
                                      transition, posting records, audit
                                      records and outbox events.

  Commit Rules                        Commit only after validations,
                                      policies, postings and audit/outbox
                                      preparation succeed.

  Rollback Rules                      Rollback on validation failure,
                                      posting failure, concurrency
                                      conflict, database constraint
                                      violation or unauthorized action.

  Posting Transaction Rules           Document state change + posting +
                                      audit + outbox must be in one
                                      transaction.

  Outbox Commit Rules                 Outbox event is saved before
                                      commit; publish occurs after
                                      commit.
  -----------------------------------------------------------------------

# **2.8 CQRS**

## **2.8.1 Command Model**

ConfirmSalesOrder\
PostInvoice\
ValidateDelivery\
ApprovePO\
RunPayroll

## **2.8.2 Query Model**

SalesOrderListItem\
StockOnHandView\
CustomerAgingSummary\
TrialBalanceView\
PendingApprovalView

## **2.8.3 Projection Model**

mermaid\
flowchart LR\
DomainEvent\[Domain Event\]\
Worker\[Projection Worker\]\
ReadModel\[(Read Model)\]\
UI\[Dashboard/List View\]\
\
DomainEvent \--\> Worker\
Worker \--\> ReadModel\
ReadModel \--\> UI

## **2.8.4 ERP CQRS Candidate Areas**

  -----------------------------------------------------------------------
  **Area**                            **CQRS Benefit**
  ----------------------------------- -----------------------------------
  Stock on hand                       Very high read volume and frequent
                                      availability queries.

  Trial balance                       Heavy aggregation across ledger
                                      lines.

  Aging reports                       Complex financial summaries.

  Approval inbox                      Cross-module aggregation.

  Dashboards                          KPI projection and fast loading.

  Audit timeline                      Append-only read optimization.

  Sales pipeline                      Kanban performance and aggregated
                                      state.
  -----------------------------------------------------------------------

## **2.8.5 CQRS Anti-Patterns**

-   Do not use CQRS for simple screens with low read pressure.

-   Do not introduce separate read models without ownership and refresh
    strategy.

-   Do not sacrifice required immediate consistency for unnecessary
    projection complexity.

# **2.9 Mediator Pattern**

## **2.9.1 Request Dispatching**

Controller → Mediator → Handler

## **2.9.2 Pipeline Behaviors**

Correlation\
Logging\
Authentication Context\
Authorization\
Validation\
Idempotency\
Transaction\
Handler\
Audit\
Event Collection\
Response Mapping

  -----------------------------------------------------------------------
  **Behavior**                        **Responsibility**
  ----------------------------------- -----------------------------------
  Logging Behavior                    Record correlation, handler name,
                                      user, company, elapsed time, status
                                      and error code.

  Validation Behavior                 Run DTO validation before handler
                                      and business validation inside
                                      handler/domain.

  Authorization Behavior              Apply shared authorization for
                                      every command/query beyond
                                      controller checks.

  Transaction Behavior                Open write transaction for commands
                                      only, not read-only queries.

  Idempotency Behavior                Protect external create, posting,
                                      payment, callbacks and import jobs.
  -----------------------------------------------------------------------

# **2.10 Backend Cross-Cutting Concerns**

## **2.10.1 Caching**

  -----------------------------------------------------------------------
  **Cache Type**                      **Use**
  ----------------------------------- -----------------------------------
  Reference cache                     Currencies, countries, UOM and
                                      stable reference data.

  Permission cache                    Evaluated permissions and scopes.

  Configuration cache                 Workflows, posting rules,
                                      thresholds.

  Lookup cache                        Small dropdowns and lookup results.

  Idempotency cache                   Prevent duplicate external
                                      requests.
  -----------------------------------------------------------------------

## **2.10.2 Background Jobs**

-   Idempotent.

-   Retryable.

-   Cancellable.

-   Observable.

-   Scheduled or event-triggered.

-   Linked to correlation/job ID.

## **2.10.3 Queues**

notification_queue\
report_queue\
integration_queue\
event_publish_queue\
import_queue\
posting_heavy_queue

## **2.10.4 Exception Handling**

  -----------------------------------------------------------------------
  **Exception Type**                  **Example**
  ----------------------------------- -----------------------------------
  ValidationException                 Required field missing.

  BusinessRuleException               Credit limit exceeded.

  AuthorizationException              User lacks permission.

  WorkflowException                   Invalid state transition.

  PostingException                    Unbalanced journal.

  ConcurrencyException                Document modified by another user.

  IntegrationException                Bank API failed.

  InfrastructureException             Database unavailable.
  -----------------------------------------------------------------------

## **2.10.5 Logging**

{\
\"correlation_id\": \"uuid\",\
\"level\": \"ERROR\",\
\"module\": \"Finance\",\
\"action\": \"PostInvoice\",\
\"document_id\": \"uuid\",\
\"user_id\": \"uuid\",\
\"error_code\": \"FIN-POST-001\"\
}

## **2.10.6 Auditing**

  -----------------------------------------------------------------------
  **Log**                             **Audit**
  ----------------------------------- -----------------------------------
  Used for troubleshooting.           Used as legal/business evidence.

  Technical focus.                    Business-oriented focus.

  May have shorter retention.         Often long retention.

  Used by developers/operations.      Used by auditors/security/business
                                      owners.
  -----------------------------------------------------------------------

## **2.10.7 Dependency Injection**

Every service, repository, adapter and provider must be injected through
dependency injection. Static service locators, hard-coded providers and
creating external clients inside handlers are forbidden.

## **2.10.8 Concurrency**

-   Use optimistic concurrency for drafts and editable documents.

-   Use version columns to detect stale updates.

-   Use row locks for posting and sequence generation.

-   Use unique constraints for idempotency keys and external references.

## **2.10.9 Performance**

-   No unbounded queries.

-   No N+1 query patterns.

-   Pagination is mandatory for lists.

-   Use projections for dashboards.

-   Batch operations run asynchronously when large.

-   SQL plans and slow queries are monitored.

# **2.11 Backend Folder Structure**

## **2.11.1 Proposed Structure**

/src\
/modules\
/finance\
/domain\
/application\
/infrastructure\
/api\
/tests\
/sales\
/domain\
/application\
/infrastructure\
/api\
/tests\
/inventory\
/domain\
/application\
/infrastructure\
/api\
/tests\
/shared\
/kernel\
/security\
/workflow\
/posting\
/audit\
/notifications\
/integration\
/platform\
/identity\
/configuration\
/observability

## **2.11.2 Module Folder Template**

/module-name\
/domain\
/entities\
/aggregates\
/value-objects\
/events\
/policies\
/specifications\
/services\
/application\
/commands\
/queries\
/dtos\
/validators\
/handlers\
/infrastructure\
/repositories\
/mappings\
/external\
/api\
/controllers\
/routes\
/tests\
/unit\
/integration\
/contract

# **2.12 Backend Naming Standards**

  ---------------------------------------------------------------------------------
  **Type**                **Naming Standard**     **Example**
  ----------------------- ----------------------- ---------------------------------
  Command                 Verb + Entity + Command ConfirmSalesOrderCommand

  Handler                 Command + Handler       ConfirmSalesOrderCommandHandler

  Query                   Get/Search + Entity +   SearchSalesOrdersQuery
                          Query                   

  Event                   Past tense business     SalesOrderConfirmed
                          name                    

  Policy                  Can + Action + Entity + CanPostInvoicePolicy
                          Policy                  

  Specification           Is/Has + Condition      IsPeriodOpenSpecification

  Repository              Entity + Repository     SalesOrderRepository

  DTO                     UseCase +               CreateInvoiceRequestDto
                          Request/Response        
  ---------------------------------------------------------------------------------

# **2.13 Backend Coding Guidelines**

## **2.13.1 Command Handler Rules**

-   1\. Authorize user and data scope.

-   2\. Validate request DTO.

-   3\. Load aggregate.

-   4\. Apply policies/specifications.

-   5\. Execute domain behavior.

-   6\. Apply workflow transition.

-   7\. Execute posting if required.

-   8\. Record audit event.

-   9\. Save outbox events.

-   10\. Commit transaction.

## **2.13.2 Query Handler Rules**

-   Apply data scope.

-   Apply field masking.

-   Use pagination.

-   Do not change state.

-   Do not publish events.

-   Audit only sensitive queries.

## **2.13.3 Entity Rules**

-   Entity does not know API.

-   Entity does not know UI.

-   Entity does not know database.

-   Entity contains business invariants.

-   Entity does not use service locator.

## **2.13.4 Aggregate Rules**

-   Protect consistency boundary.

-   Child entities are modified only through aggregate root.

-   Raise domain events.

-   Own state transition methods.

## **2.13.5 Service Rules**

-   Single responsibility.

-   Interface-driven.

-   Testable.

-   No hidden side effects.

-   Use shared logging/audit services.

## **2.13.6 Exception Rules**

Every exception must include:\
error_code\
message\
details\
correlation_id\
recoverable

## **2.13.7 Logging Rules**

Never log passwords, tokens, full bank account values, salary details,
private HR data or full sensitive payloads.

## **2.13.8 Testing Rules**

-   Domain tests.

-   Command handler tests.

-   Query tests.

-   Authorization tests.

-   Workflow tests.

-   Posting tests.

-   API contract tests.

-   Regression tests.

# **2.14 Book 2 Completion Status**

## **2.14.1 Completion Status**

  -----------------------------------------------------------------------
  **Section**                         **Status**
  ----------------------------------- -----------------------------------
  Backend Architecture Overview       Completed

  Application Layers                  Completed

  Domain Layer                        Completed

  Application Layer                   Completed

  Infrastructure Layer                Completed

  Repository Pattern                  Completed

  Unit of Work                        Completed

  CQRS                                Completed

  Mediator Pattern                    Completed

  Cross-Cutting Concerns              Completed

  Folder Structure                    Completed

  Naming Standards                    Completed

  Coding Guidelines                   Completed
  -----------------------------------------------------------------------

## **2.14.2 Coverage Checklist**

  -----------------------------------------------------------------------
  **TOC Requirement**                 **Covered**
  ----------------------------------- -----------------------------------
  Application Layers                  Yes

  Domain Layer                        Yes

  Application Layer                   Yes

  Infrastructure Layer                Yes

  Presentation Layer Boundary         Yes

  Repository Pattern                  Yes

  Unit of Work                        Yes

  CQRS                                Yes

  Mediator                            Yes

  Domain Events                       Yes

  Integration Events                  Yes

  Specifications                      Yes

  Factories                           Yes

  Policies                            Yes

  Services                            Yes

  Validators                          Yes

  DTOs                                Yes

  Commands                            Yes

  Queries                             Yes

  Pipelines                           Yes

  Caching                             Yes

  Background Jobs                     Yes

  Queues                              Yes

  Exception Handling                  Yes

  Logging                             Yes

  Auditing                            Yes

  Dependency Injection                Yes

  Transactions                        Yes

  Concurrency                         Yes

  Performance                         Yes

  Folder Structure                    Yes

  Naming Standards                    Yes

  Coding Guidelines                   Yes
  -----------------------------------------------------------------------

## **2.14.3 Cross-Reference Matrix**

  -----------------------------------------------------------------------
  **Book 2 Section**                  **Related Volume / Book**
  ----------------------------------- -----------------------------------
  Backend layers                      Book 1 Architecture Layers

  Domain layer                        Volume 2 Domain Architecture

  Commands / Queries                  Volume 3 API and Workflow
                                      Specifications

  Posting behavior                    Volume 3 Accounting Posting
                                      Specification

  Inventory behavior                  Volume 3 Inventory Posting
                                      Specification

  Authorization pipeline              Volume 3 Permission Matrix

  Audit pipeline                      Volume 2 Audit Strategy

  CQRS and read models                Volume 2 Reporting Architecture

  Queues and workers                  Book 1 Event Architecture

  Folder structure                    Volume 2 Engineering Standards
  -----------------------------------------------------------------------

## **2.14.4 Remaining Books**

-   Book 3 --- Database Technical Design

-   Book 4 --- API Technical Architecture

-   Book 5 --- Frontend Architecture

-   Book 6 --- UI Component Library

-   Book 7 --- Security Architecture

-   Book 8 --- Performance Architecture

-   Book 9 --- DevOps Architecture

-   Book 10 --- Engineering Standards

-   Book 11 --- Implementation Decision Records ADR

-   Book 12 --- Implementation Readiness Assessment
