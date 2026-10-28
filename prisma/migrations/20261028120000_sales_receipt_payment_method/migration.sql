-- How a sales receipt was paid. Other sales documents leave this blank.
ALTER TABLE "sales_documents" ADD COLUMN "paymentMethod" "PaymentMethod";
