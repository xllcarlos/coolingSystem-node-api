-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('AUTOMATICO', 'MANUAL');

-- CreateTable
CREATE TABLE "SensorData" (
    "id" TEXT NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlCommand" (
    "id" TEXT NOT NULL,
    "mode" "Mode" NOT NULL,
    "ventilador" BOOLEAN NOT NULL,
    "aspersor" BOOLEAN NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlCommand_pkey" PRIMARY KEY ("id")
);
