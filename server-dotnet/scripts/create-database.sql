IF DB_ID(N'AVASurfaceBilling') IS NULL
BEGIN
    CREATE DATABASE [AVASurfaceBilling];
END;
GO

USE [AVASurfaceBilling];
GO

PRINT 'AVASurfaceBilling database is ready for EF Core migrations.';
GO
