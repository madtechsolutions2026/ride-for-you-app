-- CreateTable
CREATE TABLE "Hub" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "city" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "openTime" TEXT,
    "closeTime" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "openTime" TEXT,
    "closeTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BikeModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "topSpeedKmph" INTEGER NOT NULL,
    "rangeKm" INTEGER NOT NULL,
    "requiresLicense" BOOLEAN NOT NULL DEFAULT false,
    "chargerIncluded" BOOLEAN NOT NULL DEFAULT false,
    "imageKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BikeModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bike" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "colour" TEXT,
    "batteryPercent" INTEGER NOT NULL DEFAULT 100,
    "odometerKm" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalPlan" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "kmLimit" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hub_status_idx" ON "Hub"("status");

-- CreateIndex
CREATE INDEX "SwapStation_status_idx" ON "SwapStation"("status");

-- CreateIndex
CREATE INDEX "BikeModel_category_idx" ON "BikeModel"("category");

-- CreateIndex
CREATE INDEX "BikeModel_status_idx" ON "BikeModel"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Bike_registrationNumber_key" ON "Bike"("registrationNumber");

-- CreateIndex
CREATE INDEX "Bike_modelId_idx" ON "Bike"("modelId");

-- CreateIndex
CREATE INDEX "Bike_hubId_idx" ON "Bike"("hubId");

-- CreateIndex
CREATE INDEX "Bike_status_idx" ON "Bike"("status");

-- CreateIndex
CREATE INDEX "RentalPlan_modelId_idx" ON "RentalPlan"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalPlan_modelId_duration_key" ON "RentalPlan"("modelId", "duration");

-- AddForeignKey
ALTER TABLE "Bike" ADD CONSTRAINT "Bike_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "BikeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bike" ADD CONSTRAINT "Bike_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "Hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalPlan" ADD CONSTRAINT "RentalPlan_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "BikeModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
