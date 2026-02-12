import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create demo contractor
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@constructai.com" },
    update: {},
    create: {
      email: "demo@constructai.com",
      name: "Mike Johnson",
      passwordHash,
      companyName: "Johnson Remodeling",
      phone: "(555) 123-4567",
      licenseNumber: "CBC-123456",
      defaultMarkup: 0,
      defaultTaxRate: 8.5,
      paymentTerms: "Net 30",
      onboardingDone: true,
    },
  });

  // Create service catalog
  const catalogItems = [
    { name: "Demolition Labor", category: "demolition", unit: "hour", defaultRate: 75 },
    { name: "Tile Installation", category: "tile", unit: "sqft", defaultRate: 12 },
    { name: "Tile Material", category: "tile", unit: "sqft", defaultRate: 8 },
    { name: "Cabinet Installation", category: "cabinets", unit: "linear_ft", defaultRate: 150 },
    { name: "Countertop - Granite", category: "countertops", unit: "sqft", defaultRate: 85 },
    { name: "Countertop - Quartz", category: "countertops", unit: "sqft", defaultRate: 95 },
    { name: "Electrical - Recessed Light", category: "electrical", unit: "each", defaultRate: 185 },
    { name: "Plumbing - Fixture Install", category: "plumbing", unit: "each", defaultRate: 250 },
    { name: "Painting", category: "painting", unit: "sqft", defaultRate: 4.5 },
    { name: "General Labor", category: "general_labor", unit: "hour", defaultRate: 65 },
    { name: "Framing", category: "framing", unit: "linear_ft", defaultRate: 18 },
    { name: "Flooring - Hardwood", category: "flooring", unit: "sqft", defaultRate: 14 },
  ];

  for (const item of catalogItems) {
    await prisma.serviceCatalogItem.create({
      data: { userId: user.id, ...item },
    });
  }

  // Create a demo customer and project
  const customer = await prisma.customer.create({
    data: {
      userId: user.id,
      name: "Sarah Williams",
      email: "sarah@example.com",
      phone: "(555) 987-6543",
      address: "123 Oak Street, Springfield, IL",
    },
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      customerId: customer.id,
      name: "Kitchen Remodel - Williams",
      address: "123 Oak Street, Springfield, IL",
      description: "Full kitchen remodel including cabinets, countertops, backsplash, and lighting",
    },
  });

  // Create a sample estimate
  const estimate = await prisma.estimate.create({
    data: {
      projectId: project.id,
      number: 1,
      title: "Kitchen Remodel - Initial Estimate",
      status: "approved",
      subtotal: 12760,
      taxRate: 8.5,
      taxAmount: 1084.6,
      total: 13844.6,
      lineItems: {
        create: [
          { description: "Demo existing kitchen", category: "demolition", quantity: 16, unit: "hour", unitPrice: 75, total: 1200, sortOrder: 0 },
          { description: "Shaker cabinets - supply & install", category: "cabinets", quantity: 20, unit: "linear_ft", unitPrice: 150, total: 3000, sortOrder: 1 },
          { description: "Granite countertops", category: "countertops", quantity: 45, unit: "sqft", unitPrice: 85, total: 3825, sortOrder: 2 },
          { description: "Subway tile backsplash", category: "tile", quantity: 30, unit: "sqft", unitPrice: 20, total: 600, sortOrder: 3 },
          { description: "Recessed lighting (6 units)", category: "electrical", quantity: 6, unit: "each", unitPrice: 185, total: 1110, sortOrder: 4 },
          { description: "Plumbing - sink & faucet install", category: "plumbing", quantity: 2, unit: "each", unitPrice: 250, total: 500, sortOrder: 5 },
          { description: "Wall painting", category: "painting", quantity: 350, unit: "sqft", unitPrice: 4.5, total: 1575, sortOrder: 6 },
          { description: "General cleanup & haul-away", category: "general_labor", quantity: 14, unit: "hour", unitPrice: 65, total: 910, sortOrder: 7 },
        ],
      },
    },
  });

  // Create a sample change order
  await prisma.changeOrder.create({
    data: {
      projectId: project.id,
      estimateId: estimate.id,
      number: 1,
      title: "Upgrade to Quartz Countertops",
      description: "Customer requested upgrade from granite to quartz countertops",
      status: "approved",
      costImpact: 450,
      lineItems: {
        create: [
          { action: "remove", description: "Granite countertops", quantity: 45, unit: "sqft", unitPrice: 85, total: -3825 },
          { action: "add", description: "Quartz countertops", quantity: 45, unit: "sqft", unitPrice: 95, total: 4275 },
        ],
      },
    },
  });

  // Create a sample invoice
  await prisma.invoice.create({
    data: {
      projectId: project.id,
      number: 1,
      status: "sent",
      subtotal: 4200,
      taxRate: 8.5,
      taxAmount: 357,
      total: 4557,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lineItems: {
        create: [
          { description: "Demo existing kitchen - complete", quantity: 16, unit: "hour", unitPrice: 75, total: 1200, sortOrder: 0 },
          { description: "Shaker cabinets - supply & install", quantity: 20, unit: "linear_ft", unitPrice: 150, total: 3000, sortOrder: 1 },
        ],
      },
    },
  });

  // Create audit logs
  await prisma.auditLog.createMany({
    data: [
      { projectId: project.id, userId: user.id, action: "estimate_created", entityType: "estimate", entityId: estimate.id, details: { title: "Kitchen Remodel - Initial Estimate" } },
      { projectId: project.id, userId: user.id, action: "estimate_approved", entityType: "estimate", entityId: estimate.id },
      { projectId: project.id, userId: user.id, action: "change_order_created", entityType: "change_order", entityId: "demo", details: { title: "Upgrade to Quartz" } },
      { projectId: project.id, userId: user.id, action: "invoice_created", entityType: "invoice", entityId: "demo", details: { total: 4557 } },
    ],
  });

  console.log("Seed data created successfully!");
  console.log(`Demo login: demo@constructai.com / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
