PRODUCTION INSTALLER PREREQUISITE

Place the official Microsoft SQL Server 2025 Express x64 full-media installer in this folder with this exact name:

    SQLEXPR_x64_ENU.exe

Do NOT use the small SQL2025-SSEI-Expr.exe web/bootstrapper for the offline installer. The production build expects the full x64 media so SQL Server Setup can be run with the unattended configuration used by the installer.

Download SQL Server Express from Microsoft's official SQL Server downloads page:
https://www.microsoft.com/en/sql-server/sql-server-downloads

SQL Server Express is the intended local production database engine for this deployment. The installer configures a named instance:

    .\SQLEXPRESS

Database:

    AVASurfaceBilling

The SQL Server media is intentionally ignored by Git because it is a large third-party binary. It is bundled into the final Setup.exe only on the build machine.
