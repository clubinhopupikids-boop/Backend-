-- Add the ChildActivityType values in an isolated migration.
-- PostgreSQL does not allow a newly-added enum value to be used before the
-- transaction that adds it has committed.
ALTER TYPE "ChildActivityType" ADD VALUE 'LIBRARY_STARTED';
ALTER TYPE "ChildActivityType" ADD VALUE 'LIBRARY_COMPLETED';
