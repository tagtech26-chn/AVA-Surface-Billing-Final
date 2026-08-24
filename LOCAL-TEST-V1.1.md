# AVASurface v1.1 Local Test Package

Branch: `feature/v1.1.0-enterprise-management`

## 1. Update local branch

```powershell
git fetch origin
git checkout feature/v1.1.0-enterprise-management
git pull origin feature/v1.1.0-enterprise-management
```

## 2. Install dependencies

```powershell
npm ci
dotnet restore server-dotnet/AVASurface.Server.csproj
dotnet restore server-dotnet.Tests/AVASurface.Server.Tests.csproj
```

## 3. Apply development database migrations

Use the local development SQL Server/database configured for this branch. Apply pending EF migrations before starting the API:

```powershell
dotnet ef database update --project server-dotnet/AVASurface.Server.csproj
```

Do not point this at production without a backup.

## 4. Validate code

```powershell
dotnet build server-dotnet/AVASurface.Server.csproj -c Release

dotnet test server-dotnet.Tests/AVASurface.Server.Tests.csproj -c Release
npm run lint
npm run build
```

## 5. Start the backend

```powershell
cd server-dotnet
dotnet run
```

The API should expose:

```text
/api/health
```

and return `status = ok` when SQL Server is reachable.

## 6. Start the frontend

In a second terminal from the repository root:

```powershell
npm run dev
```

## 7. Performance checks

Open browser DevTools > Network and verify:

- Login does not request the complete invoice history before POS becomes usable.
- Product search uses `/api/products?...pageSize=20`.
- Customer search can use `/api/customers/search?q=...` and returns a small result set.
- Invoice list uses `/api/invoices?page=1&pageSize=50` rather than downloading all invoice lines.
- Opening an invoice fetches its detailed lines/payments only when required.

## 8. Billing-category pricing test

Create prices for one product:

```text
Retail Sale             95
Wholesale               80
Projects                85
Engineer & Contractors  88
```

Map customers independently of B2B/B2C:

```text
B2C customer -> Retail Sale
B2B customer -> Wholesale
B2B customer -> Projects
B2C customer -> Engineer & Contractors
```

Create the same invoice line for each customer and verify the server applies 95/80/85/88 respectively.

## 9. Inventory tests

- Deactivate an item as Manager/Admin.
- Refresh.
- Open deactivated items.
- Reactivate it.
- Confirm it returns to the active master.
- Create a completely new item.
- Confirm the new item is persisted in SQL Server and visible after refresh.

## 10. Customer API compatibility

Existing development callers can continue using:

```text
GET /api/customers
```

The scalable endpoints are:

```text
GET /api/customers/page?page=1&pageSize=50
GET /api/customers/search?q=abc&limit=20
```

This keeps v1.1 development stable while the frontend is progressively moved to server-side customer search.
