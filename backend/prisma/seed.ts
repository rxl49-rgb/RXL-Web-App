import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const JAMAICAN_CITIES = ['Kingston', 'Montego Bay', 'Spanish Town', 'Portmore', 'May Pen', 'Mandeville', 'Ocho Rios', 'Little River', 'Negril', 'Savanna-la-Mar'];
const FIRST_NAMES = ['Jessica', 'Shanice', 'Petrina', 'Marcus', 'Andre', 'Kimberly', 'Damion', 'Latoya', 'Ricardo', 'Simone', 'Kevin', 'Nadine', 'Orville', 'Tashana', 'Owen', 'Kerry-Ann', 'Rohan', 'Sasha', 'Delroy', 'Ann-Marie'];
const LAST_NAMES = ['Smith-Campbell', 'Heron', 'Burchell', 'Brown', 'Grant', 'Reid', 'Campbell', 'Williams', 'Thompson', 'Clarke', 'Hylton', 'Chin', 'Robinson', 'Bailey', 'Dunkley', 'Morgan', 'Wright', 'Bennett', 'Foster', 'Powell'];
const STREETS = ['Barrett Town', 'Tucker District', 'Cornwall Court', 'Half Way Tree Rd', 'Constant Spring Rd', 'Hope Road', 'Red Hills Rd', 'Washington Blvd', 'Molynes Rd', 'Waterloo Rd'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  return `876${Math.floor(1000000 + Math.random() * 8999999)}`;
}

function randomTrn() {
  return String(Math.floor(100000000 + Math.random() * 899999999));
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log('Seeding database...');

  // Admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rxllogistics.com' },
    update: {},
    create: {
      email: 'admin@rxllogistics.com', name: 'RXL Admin', password: adminPassword, role: 'ADMIN',
      phone: '+1-800-RXL-SHIP', status: 'ACTIVE', city: 'Kingston', country: 'Jamaica', lastActiveAt: new Date(),
    },
  });

  // Demo customer
  const customerPassword = await bcrypt.hash('customer123', 12);
  const customer = await prisma.user.upsert({
    where: { email: 'demo@rxllogistics.com' },
    update: {},
    create: {
      email: 'demo@rxllogistics.com', name: 'Demo Customer', firstName: 'Demo', lastName: 'Customer', password: customerPassword,
      phone: '5550100', phoneCarrier: 'Digicel', address: '123 Main St', city: 'Miami', country: 'USA',
      customerCode: 'RXL4000', status: 'ACTIVE', lastActiveAt: daysAgo(0.2),
    },
  });

  const demoLoginCount = await prisma.loginEvent.count({ where: { userId: customer.id } });
  if (demoLoginCount === 0) {
    for (const [daysBack, ok] of [[0.2, true], [1, true], [3, true], [7, false], [8, true]] as [number, boolean][]) {
      await prisma.loginEvent.create({
        data: { userId: customer.id, ip: '203.0.113.42', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', success: ok, createdAt: daysAgo(daysBack) },
      });
    }
  }

  // Sample customer roster for the admin Customers screen
  const samplePassword = await bcrypt.hash('Sample123!', 12);
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'INACTIVE', 'BLOCKED'];
  const devices = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/125.0 Mobile',
  ];
  for (let i = 0; i < 40; i++) {
    const first = randomFrom(FIRST_NAMES);
    const last = randomFrom(LAST_NAMES);
    const email = `${first.toLowerCase().replace(/[^a-z]/g, '')}${last.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6)}${i}@example.com`;
    const status = randomFrom(statuses);
    const lastActiveAt = Math.random() > 0.15 ? daysAgo(Math.floor(Math.random() * 30)) : null;
    const sampleCustomer = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `${first} ${last}`,
        firstName: first,
        lastName: last,
        password: samplePassword,
        phone: randomPhone(),
        phoneCarrier: randomFrom(['Digicel', 'Flow']),
        trn: randomTrn(),
        address: randomFrom(STREETS),
        city: randomFrom(JAMAICAN_CITIES),
        country: 'Jamaica',
        customerCode: `RXL${4001 + i}`,
        status,
        role: 'CUSTOMER',
        lastActiveAt,
      },
    });

    // Give the first 15 sample customers a bit of login history for the admin "login profile" view
    if (i < 15) {
      const loginCount = 2 + Math.floor(Math.random() * 6);
      const existingLogins = await prisma.loginEvent.count({ where: { userId: sampleCustomer.id } });
      if (existingLogins === 0) {
        for (let j = 0; j < loginCount; j++) {
          await prisma.loginEvent.create({
            data: {
              userId: sampleCustomer.id,
              ip: `172.16.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
              userAgent: randomFrom(devices),
              success: Math.random() > 0.1,
              createdAt: daysAgo(j * (2 + Math.random() * 3)),
            },
          });
        }
      }
    }
  }

  // Remove the old freight-supply catalog (Packaging/Insurance/Tracking/Freight Services) —
  // the Store is now a general consumer catalog instead. Products must go before categories
  // to satisfy the foreign key.
  const legacyCategorySlugs = ['packaging', 'insurance', 'tracking', 'services', 'household'];
  await prisma.product.deleteMany({ where: { category: { slug: { in: legacyCategorySlugs } } } });
  await prisma.category.deleteMany({ where: { slug: { in: legacyCategorySlugs } } });

  // Categories
  const electronics = await prisma.category.upsert({ where: { slug: 'electronics' }, update: {}, create: { name: 'Electronics', slug: 'electronics' } });
  const appliances = await prisma.category.upsert({ where: { slug: 'appliances' }, update: {}, create: { name: 'Appliances', slug: 'appliances' } });
  const footwear = await prisma.category.upsert({ where: { slug: 'footwear' }, update: {}, create: { name: 'Footwear', slug: 'footwear' } });
  const apparel = await prisma.category.upsert({ where: { slug: 'apparel' }, update: {}, create: { name: 'Apparel', slug: 'apparel' } });
  const toiletries = await prisma.category.upsert({ where: { slug: 'toiletries' }, update: {}, create: { name: 'Toiletries', slug: 'toiletries' } });

  // Products
  const products = [
    // Electronics
    { name: 'iPhone 17 Pro Max 256GB', description: 'The latest iPhone with titanium design, A19 Pro chip, and pro camera system. Unlocked.', price: 1199.99, categoryId: electronics.id, stock: 40, sku: 'ELEC-IPH17PM-256', weight: 0.5 },
    { name: 'iPhone 17 Pro Max 512GB', description: 'The latest iPhone with titanium design, A19 Pro chip, and pro camera system. Unlocked.', price: 1399.99, categoryId: electronics.id, stock: 25, sku: 'ELEC-IPH17PM-512', weight: 0.5 },
    { name: 'LG 65" OLED evo TV', description: '4K Smart OLED TV with self-lit pixels, AI picture processing, and webOS.', price: 1799.99, categoryId: electronics.id, stock: 15, sku: 'ELEC-LG-OLED65', weight: 22.5 },
    { name: 'LG 55" QNED TV', description: '4K QNED Mini LED Smart TV with vivid color and quantum dot technology.', price: 899.99, categoryId: electronics.id, stock: 20, sku: 'ELEC-LG-QNED55', weight: 17.0 },
    { name: 'Samsung 50" Crystal UHD TV', description: '4K Crystal UHD Smart TV with vibrant colors and built-in streaming apps.', price: 549.99, categoryId: electronics.id, stock: 30, sku: 'ELEC-SAM-CUHD50', weight: 15.0 },
    { name: 'Apple AirPods Pro (3rd Gen)', description: 'Active noise cancellation, adaptive audio, and USB-C charging case.', price: 249.99, categoryId: electronics.id, stock: 60, sku: 'ELEC-APP-AIRPODSPRO3', weight: 0.1 },
    // Appliances
    { name: 'Samsung 28 cu.ft French Door Refrigerator', description: 'Family Hub smart fridge with dual ice maker and FlexZone drawer.', price: 2199.99, categoryId: appliances.id, stock: 8, sku: 'APPL-SAM-FRIDGE28', weight: 135.0 },
    { name: 'Samsung Front Load Washer 5.2 cu.ft', description: 'Smart washer with Super Speed wash and AI-optimized cycles.', price: 899.99, categoryId: appliances.id, stock: 12, sku: 'APPL-SAM-WASH52', weight: 78.0 },
    { name: 'Samsung Electric Dryer 7.4 cu.ft', description: 'Sensor dry technology with steam sanitize cycle.', price: 799.99, categoryId: appliances.id, stock: 12, sku: 'APPL-SAM-DRY74', weight: 65.0 },
    { name: 'Samsung Countertop Microwave', description: '1.1 cu.ft countertop microwave with Sensor Cook technology.', price: 129.99, categoryId: appliances.id, stock: 35, sku: 'APPL-SAM-MICRO11', weight: 12.0 },
    { name: 'Samsung Dishwasher StormWash', description: 'Built-in dishwasher with StormWash and third rack for extra capacity.', price: 649.99, categoryId: appliances.id, stock: 10, sku: 'APPL-SAM-DISH01', weight: 48.0 },
    // Footwear
    { name: 'Nike Air Max 270', description: "Men's lifestyle sneaker with Nike's largest heel Air unit for all-day comfort.", price: 150.00, categoryId: footwear.id, stock: 50, sku: 'SHOE-NIKE-AM270', weight: 0.8 },
    { name: 'Adidas Ultraboost 22', description: 'Responsive running shoe with BOOST midsole and Primeknit upper.', price: 180.00, categoryId: footwear.id, stock: 45, sku: 'SHOE-ADI-UB22', weight: 0.7 },
    { name: 'Timberland 6" Premium Boot', description: 'Iconic waterproof leather boot with padded collar for all-day comfort.', price: 198.00, categoryId: footwear.id, stock: 30, sku: 'SHOE-TIMB-6PREM', weight: 1.3 },
    { name: 'Crocs Classic Clog', description: 'Lightweight, comfortable clog with ventilation ports. Available in multiple colors.', price: 49.99, categoryId: footwear.id, stock: 80, sku: 'SHOE-CROCS-CLASSIC', weight: 0.3 },
    // Apparel
    { name: "Levi's 501 Original Jeans", description: "Classic straight-leg denim with a button fly. The original since 1873.", price: 69.99, categoryId: apparel.id, stock: 55, sku: 'APRL-LEVI-501', weight: 0.7 },
    { name: 'Nike Dri-FIT T-Shirt', description: 'Lightweight, sweat-wicking training tee for everyday comfort.', price: 29.99, categoryId: apparel.id, stock: 90, sku: 'APRL-NIKE-DRIFIT', weight: 0.2 },
    { name: 'Champion Reverse Weave Hoodie', description: 'Heavyweight fleece pullover hoodie that resists shrinkage.', price: 64.99, categoryId: apparel.id, stock: 40, sku: 'APRL-CHAMP-HOODIE', weight: 0.9 },
    { name: 'Carhartt Duck Canvas Jacket', description: 'Rugged, relaxed-fit workwear jacket with a blanket-lined interior.', price: 119.99, categoryId: apparel.id, stock: 25, sku: 'APRL-CHTT-DUCKJKT', weight: 1.6 },
    { name: 'Hanes ComfortSoft Crew Socks 6-Pack', description: 'Cushioned crew socks in breathable cotton blend.', price: 14.99, categoryId: apparel.id, stock: 100, sku: 'APRL-HANES-SOCKS6', weight: 0.3 },
    // Toiletries
    { name: 'Dove Body Wash 3-Pack', description: 'Moisturizing body wash with NutriumMoisture, 22 oz bottles.', price: 18.99, categoryId: toiletries.id, stock: 70, sku: 'TOIL-DOVE-BW3PK', weight: 2.0 },
    { name: 'Colgate Total Toothpaste 3-Pack', description: 'Whole mouth health toothpaste, 4.8 oz tubes.', price: 12.99, categoryId: toiletries.id, stock: 85, sku: 'TOIL-COLG-TOTAL3PK', weight: 0.6 },
    { name: 'Old Spice Deodorant 3-Pack', description: 'Long-lasting antiperspirant and deodorant, assorted scents.', price: 16.99, categoryId: toiletries.id, stock: 65, sku: 'TOIL-OLDSP-DEO3PK', weight: 0.4 },
    { name: 'Pantene Shampoo & Conditioner Set', description: 'Pro-V nourishing shampoo and conditioner duo, 25.4 oz each.', price: 22.99, categoryId: toiletries.id, stock: 50, sku: 'TOIL-PANT-SHCOSET', weight: 1.8 },
    { name: 'Gillette Fusion5 Razor Kit', description: '5-blade razor with 1 handle and 4 refill cartridges.', price: 24.99, categoryId: toiletries.id, stock: 60, sku: 'TOIL-GILL-FUSION5', weight: 0.3 },
  ];

  for (const p of products) {
    await prisma.product.upsert({ where: { sku: p.sku }, update: {}, create: p });
  }

  // Demo shipments
  const shipment1 = await prisma.shipment.upsert({
    where: { trackingNumber: 'RXL-2024-AIR-001' },
    update: { itemCount: 3 },
    create: {
      trackingNumber: 'RXL-2024-AIR-001',
      userId: customer.id,
      type: 'AIR',
      status: 'IN_TRANSIT',
      origin: 'Miami, FL, USA',
      destination: 'London, UK',
      weight: 12.5,
      dimensions: '60x40x30',
      description: 'Electronics - Handle with care',
      itemCount: 3,
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  });

  for (const event of [
    { location: 'Miami, FL, USA', description: 'Shipment picked up from sender', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { location: 'Miami International Airport, FL, USA', description: 'Cleared customs, loaded onto aircraft', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { location: 'JFK Airport, New York, USA', description: 'Transit hub – connecting flight', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    { location: 'Heathrow Airport, London, UK', description: 'Arrived at destination country – customs processing', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000) },
  ]) {
    await prisma.trackingEvent.create({ data: { shipmentId: shipment1.id, ...event } });
  }

  const shipment2 = await prisma.shipment.upsert({
    where: { trackingNumber: 'RXL-2024-SEA-002' },
    update: { itemCount: 10 },
    create: {
      trackingNumber: 'RXL-2024-SEA-002',
      userId: customer.id,
      type: 'SEA',
      status: 'PROCESSING',
      origin: 'Kingston, Jamaica',
      destination: 'Miami, FL, USA',
      weight: 450,
      dimensions: '120x80x100',
      description: 'Household goods',
      itemCount: 10,
      estimatedDelivery: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
    },
  });

  for (const event of [
    { location: 'Kingston Port, Jamaica', description: 'Cargo received at port warehouse', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    { location: 'Kingston Port, Jamaica', description: 'Documentation verified, awaiting vessel', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
  ]) {
    await prisma.trackingEvent.create({ data: { shipmentId: shipment2.id, ...event } });
  }

  // Tracking-number breakdown for the two original legacy demo shipments.
  const legacyShipmentItems: Record<string, { shipmentId: string; items: { courier: string; trackingNumber?: string; description?: string }[] }> = {
    'RXL-2024-AIR-001': {
      shipmentId: shipment1.id,
      items: [
        { courier: 'FEDEX', trackingNumber: '782310445690201122' },
        { courier: 'UPS', trackingNumber: '1Z999AA10145236789' },
        { courier: 'GOFO', trackingNumber: 'GFUS01098765432' },
      ],
    },
    'RXL-2024-SEA-002': {
      shipmentId: shipment2.id,
      items: [
        { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511589202' },
        { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511587541' },
        { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511588618' },
        { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511587861' },
        { courier: 'Amazon', trackingNumber: 'TBA333066145947' },
        { courier: 'Amazon', trackingNumber: '9632001960206677396100874816558060' },
        { courier: 'UPS', trackingNumber: '1ZHF88944200047370' },
        { courier: 'USPS', trackingNumber: '420333249234690394109102456498' },
        { courier: 'GOFO', trackingNumber: 'GFUS01063547171907' },
        { courier: 'DHL', trackingNumber: '3245678922' },
      ],
    },
  };
  for (const { shipmentId, items } of Object.values(legacyShipmentItems)) {
    const existing = await prisma.shipmentItem.count({ where: { shipmentId } });
    if (existing > 0) continue;
    for (const item of items) {
      await prisma.shipmentItem.create({ data: { shipmentId, ...item } });
    }
  }

  // Additional demo shipments for the customer account, matching the reference
  // "Shipments" dashboard mockup (tracking numbers + statuses), minus any customer
  // name/email — and showing a price (totalUSD) instead of weight in the UI.
  const oldDemoTrackingNumbers = ['RXL-2025-00131', 'RXL-2025-00145', 'RXL-2025-00152', 'RXL-2025-00168', 'RXL-2025-00174'];
  await prisma.shipment.deleteMany({ where: { trackingNumber: { in: oldDemoTrackingNumbers } } });

  const demoShipments = [
    { trackingNumber: 'RXL-2025-00134', type: 'AIR', status: 'PROCESSING', origin: 'Miami, FL, USA', destination: 'Kingston, Jamaica', weight: 5.0, price: 15.00, paid: 0, itemCount: 2, daysAgo: 0 },
    { trackingNumber: 'RXL-2025-00133', type: 'SEA', status: 'IN_TRANSIT', origin: 'Miami, FL, USA', destination: 'Ocho Rios, Jamaica', weight: 41.0, price: 312.75, paid: 0, itemCount: 2, daysAgo: 2 },
    { trackingNumber: 'RXL-2025-00132', type: 'AIR', status: 'PROCESSING', origin: 'Miami, FL, USA', destination: 'Kingston, Jamaica', weight: 7.5, price: 60.00, paid: 0, itemCount: 1, daysAgo: 0 },
    { trackingNumber: 'RXL-2025-00130', type: 'AIR', status: 'OUT_FOR_DELIVERY', origin: 'Fort Lauderdale, FL, USA', destination: 'Kingston, Jamaica', weight: 22.4, price: 178.20, paid: 178.20, itemCount: 3, daysAgo: 8 },
    { trackingNumber: 'RXL-2025-00129', type: 'SEA', status: 'DELIVERED', origin: 'Miami, FL, USA', destination: 'Montego Bay, Jamaica', weight: 55.0, price: 288.75, paid: 288.75, itemCount: 4, daysAgo: 18 },
    { trackingNumber: 'RXL-2025-00128', type: 'SEA', status: 'IN_TRANSIT', origin: 'Miami, FL, USA', destination: 'Kingston, Jamaica', weight: 24.5, price: 186.50, paid: 0, itemCount: 3, daysAgo: 6 },
    { trackingNumber: 'RXL-2025-00127', type: 'AIR', status: 'OUT_FOR_DELIVERY', origin: 'Miami, FL, USA', destination: 'Montego Bay, Jamaica', weight: 18.0, price: 142.00, paid: 142.00, itemCount: 2, daysAgo: 9 },
    { trackingNumber: 'RXL-2025-00126', type: 'AIR', status: 'DELIVERED', origin: 'Orlando, FL, USA', destination: 'Kingston, Jamaica', weight: 12.3, price: 97.60, paid: 97.60, itemCount: 1, daysAgo: 15 },
    { trackingNumber: 'RXL-2025-00125', type: 'SEA', status: 'IN_TRANSIT', origin: 'Miami, FL, USA', destination: 'Ocho Rios, Jamaica', weight: 30.2, price: 245.90, paid: 0, itemCount: 4, daysAgo: 3 },
    { trackingNumber: 'RXL-2025-00124', type: 'AIR', status: 'PROCESSING', origin: 'Miami, FL, USA', destination: 'Montego Bay, Jamaica', weight: 15.6, price: 0, paid: 5600.00, itemCount: 5, daysAgo: 1 }, // matches reference invoice card exactly: Total Charges $0.00 / Amount Paid $5,600.00
    { trackingNumber: 'RXL-2025-00123', type: 'AIR', status: 'DELIVERED', origin: 'Miami, FL, USA', destination: 'May Pen, Jamaica', weight: 9.8, price: 78.40, paid: 78.40, itemCount: 1, daysAgo: 20 },
  ];
  for (const d of demoShipments) {
    await prisma.shipment.upsert({
      where: { trackingNumber: d.trackingNumber },
      update: {
        type: d.type,
        status: d.status,
        origin: d.origin,
        destination: d.destination,
        weight: d.weight,
        totalUSD: d.price,
        amountPaid: d.paid,
        itemCount: d.itemCount,
      },
      create: {
        trackingNumber: d.trackingNumber,
        userId: customer.id,
        type: d.type,
        status: d.status,
        origin: d.origin,
        destination: d.destination,
        weight: d.weight,
        totalUSD: d.price,
        amountPaid: d.paid,
        itemCount: d.itemCount,
        createdAt: new Date(Date.now() - d.daysAgo * 24 * 60 * 60 * 1000),
        estimatedDelivery: new Date(Date.now() + (7 - d.daysAgo) * 24 * 60 * 60 * 1000),
        deliveredAt: d.status === 'DELIVERED' ? new Date(Date.now() - (d.daysAgo - 2) * 24 * 60 * 60 * 1000) : null,
      },
    });
  }

  // Per-shipment courier / tracking-number breakdown, shown when a customer clicks
  // into a shipment on the Shipment page or Home overview.
  const shipmentItemsByTracking: Record<string, { courier: string; trackingNumber?: string; description?: string }[]> = {
    'RXL-2025-00128': [
      { courier: 'FEDEX', trackingNumber: '782310445690123456' },
      { courier: 'UPS', trackingNumber: '1Z999AA10123456784' },
      { courier: 'Amazon', description: 'Bluetooth Speaker (2-pack)' },
    ],
    'RXL-2025-00127': [
      { courier: 'FEDEX', trackingNumber: '782310445690198212' },
      { courier: 'USPS', trackingNumber: '9400111899223197428' },
    ],
    'RXL-2025-00126': [
      { courier: 'Amazon', description: 'Kitchen Air Fryer 6qt' },
    ],
    'RXL-2025-00125': [
      { courier: 'FEDEX', trackingNumber: '782310445690145522' },
      { courier: 'UPS', trackingNumber: '1Z999AA10198765432' },
      { courier: 'DHL', trackingNumber: '3245678901' },
      { courier: 'Amazon', description: 'Office Chair – Ergonomic' },
    ],
    // Matches the customer-provided reference mockup exactly.
    'RXL-2025-00124': [
      { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511589202' },
      { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511587541' },
      { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511588618' },
      { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511587861' },
      { courier: 'Amazon', trackingNumber: 'TBA333066145947' },
    ],
    'RXL-2025-00123': [
      { courier: 'FEDEX', trackingNumber: '782310445690177733' },
    ],
    'RXL-2025-00129': [
      { courier: 'UPS', trackingNumber: '1Z999AA10156784321' },
      { courier: 'FEDEX', trackingNumber: '782310445690112299' },
      { courier: 'DHL', trackingNumber: '3245691234' },
      { courier: 'Amazon', description: 'Patio Umbrella 9ft' },
    ],
    'RXL-2025-00130': [
      { courier: 'FEDEX', trackingNumber: '782310445690166541' },
      { courier: 'USPS', trackingNumber: '9400111899223188315' },
      { courier: 'Amazon', description: 'Cordless Drill Set' },
    ],
    'RXL-2025-00132': [
      { courier: 'Amazon', description: 'Laptop Stand – Aluminum' },
    ],
    'RXL-2025-00133': [
      { courier: 'UPS', trackingNumber: '1Z999AA10187654123' },
      { courier: 'FEDEX', trackingNumber: '782310445690189987' },
    ],
    // Newly scanned at the warehouse — shows up in the Home "Recently Scanned" pending list.
    'RXL-2025-00134': [
      { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511589202' },
      { courier: 'FEDEX', trackingNumber: '9622001900005654546900398511587541' },
    ],
  };
  for (const [trackingNumber, items] of Object.entries(shipmentItemsByTracking)) {
    const shipment = await prisma.shipment.findUnique({ where: { trackingNumber } });
    if (!shipment) continue;
    const existing = await prisma.shipmentItem.count({ where: { shipmentId: shipment.id } });
    if (existing > 0) continue; // already seeded
    for (const item of items) {
      await prisma.shipmentItem.create({ data: { shipmentId: shipment.id, ...item } });
    }
  }

  // Sample batches + freight shipments for the admin Batches / Freight screens
  const PICKUP_LOCATIONS = ['Freeport', 'Kingston', 'Montego Bay', 'May Pen', 'Ocho Rios'];
  const BATCH_STATUSES = ['PROCESSING', 'IN_TRANSIT', 'AT_PORT_JAMAICA'];
  const COURIERS = ['Amazon Logistics (TBA)', 'GOFO EXPRESS', 'USPS', 'UPS', 'FedEx'];
  const allSampleCustomers = await prisma.user.findMany({ where: { role: 'CUSTOMER' } });

  const existingBatchCount = await prisma.batch.count();
  if (existingBatchCount === 0 && allSampleCustomers.length > 0) {
    const batchDefs = [
      { batchNumber: 'JUL_13_2026_WK28', status: 'AT_PORT_JAMAICA', items: 12, daysAgo: 16 },
      { batchNumber: 'JUL_20_2026_WK29', status: 'IN_TRANSIT', items: 9, daysAgo: 9 },
      { batchNumber: 'Air_JUL_22_WK_29-2', status: 'PROCESSING', items: 7, daysAgo: 7 },
      { batchNumber: 'Air_JUL_25_WK_30-1', status: 'PROCESSING', items: 5, daysAgo: 4 },
      { batchNumber: 'JUL_27_2026_WK30', status: 'IN_TRANSIT', items: 8, daysAgo: 2 },
    ];

    for (const def of batchDefs) {
      const batch = await prisma.batch.create({
        data: {
          batchNumber: def.batchNumber,
          pickupLocation: randomFrom(PICKUP_LOCATIONS),
          status: def.status,
          createdAt: daysAgo(def.daysAgo),
        },
      });

      for (let i = 0; i < def.items; i++) {
        const cust = randomFrom(allSampleCustomers);
        const custInvoiceTotal = Math.round((30 + Math.random() * 220) * 100) / 100;
        const freightCharge = Math.round((8 + Math.random() * 25) * 100) / 100;
        const dutyFee = Math.random() > 0.6 ? Math.round(Math.random() * 15 * 100) / 100 : 0;
        const gct = Math.round(freightCharge * 0.15 * 100) / 100;
        const totalUSD = Math.round((freightCharge + dutyFee + gct) * 100) / 100;
        const totalJMD = Math.round(totalUSD * 158 * 100) / 100;
        const amountPaid = Math.random() > 0.4 ? totalUSD : Math.round(totalUSD * Math.random() * 0.6 * 100) / 100;

        await prisma.shipment.create({
          data: {
            trackingNumber: `${def.batchNumber}-${i + 1}-${Math.floor(Math.random() * 100000)}`,
            userId: cust.id,
            type: randomFrom(['AIR', 'SEA', 'GROUND']),
            status: def.status,
            origin: 'Miami, FL, USA',
            destination: 'Kingston, Jamaica',
            weight: Math.round(Math.random() * 20 * 100) / 100,
            description: 'Freight item',
            itemCount: 1 + Math.floor(Math.random() * 3),
            pickupLocation: batch.pickupLocation,
            courierInfo: `${randomFrom(['TBA', 'GFUS', '1Z', '9400'])}${Math.floor(100000000 + Math.random() * 899999999)} (${randomFrom(COURIERS)})`,
            issueStatus: Math.random() > 0.9 ? 'Weight discrepancy' : 'No issue',
            batchId: batch.id,
            freightCharge,
            dutyFee,
            gct,
            totalUSD,
            totalJMD,
            amountPaid,
            createdAt: daysAgo(def.daysAgo),
          },
        });
      }
    }
  }

  // Sample Business Journal entries (income/expense ledger for the admin Biz Journal screen)
  const existingJournalCount = await prisma.bizJournalEntry.count();
  if (existingJournalCount === 0) {
    const journalDefs: { title: string; entryType: string; currency: string; paymentType: string; amount: number; daysAgo: number }[] = [
      { title: 'Camalo Rhoden Air-Shipment Transportation Tuesday, June 30, 2026 Accumulated Wks', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 85100, daysAgo: 28 },
      { title: 'Bisnorth Headley Remaining Of Partial Salary Tuesday, June 30, 206', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 10000, daysAgo: 28 },
      { title: 'Truck man Al Transportation of Air Goods Monday, June 29, 2026', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 20000, daysAgo: 28 },
      { title: 'Richard Excel (Ray) Final Payment Thursday, July 2, 2026', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 55000, daysAgo: 27 },
      { title: 'shemar Saturday work', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 5000, daysAgo: 23 },
      { title: 'Bisnorth Saturday work', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 5000, daysAgo: 23 },
      { title: 'Camalo Rhoden for shipments', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 17300, daysAgo: 23 },
      { title: 'Forklift Wk22 Monday, July 6, 2026', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 5000, daysAgo: 23 },
      { title: 'Warehouse rent — July', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Bank Transfer', amount: 45000, daysAgo: 22 },
      { title: 'Office supplies — printer paper, ink', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Card', amount: 8500, daysAgo: 20 },
      { title: 'Fuel for delivery van', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 12000, daysAgo: 18 },
      { title: 'Customs brokerage fee — July batch', entryType: 'EXPENSE', currency: 'USD', paymentType: 'Bank Transfer', amount: 113, daysAgo: 16 },
      { title: 'Freight forwarding partner invoice', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cheque', amount: 22000, daysAgo: 14 },
      { title: 'Weekly wages — warehouse team', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 15100, daysAgo: 12 },
      { title: 'Customer shipping fee — RXL4012', entryType: 'INCOME', currency: 'JMD', paymentType: 'Cash', amount: 18500, daysAgo: 10 },
      { title: 'Customer shipping fee — RXL4027', entryType: 'INCOME', currency: 'JMD', paymentType: 'Card', amount: 24200, daysAgo: 9 },
      { title: 'Customer shipping fee — RXL4033', entryType: 'INCOME', currency: 'USD', paymentType: 'Card', amount: 65, daysAgo: 8 },
      { title: 'Customer shipping fee — RXL4041', entryType: 'INCOME', currency: 'JMD', paymentType: 'Bank Transfer', amount: 31200, daysAgo: 6 },
      { title: 'Storage fee — overdue pickup', entryType: 'INCOME', currency: 'JMD', paymentType: 'Cash', amount: 6500, daysAgo: 4 },
      { title: 'Insurance claim payout', entryType: 'INCOME', currency: 'USD', paymentType: 'Bank Transfer', amount: 48, daysAgo: 2 },
      { title: 'Vehicle maintenance — delivery truck', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Card', amount: 9600, daysAgo: 1 },
      { title: 'Packaging materials restock', entryType: 'EXPENSE', currency: 'JMD', paymentType: 'Cash', amount: 4200, daysAgo: 0 },
    ];

    for (const def of journalDefs) {
      await prisma.bizJournalEntry.create({
        data: {
          title: def.title,
          entryType: def.entryType,
          currency: def.currency,
          paymentType: def.paymentType,
          amount: def.amount,
          createdById: admin.id,
          createdAt: daysAgo(def.daysAgo),
          updatedAt: daysAgo(def.daysAgo),
        },
      });
    }
  }

  // Sample manifests for the admin Manifest Management screen
  const existingManifestCount = await prisma.manifest.count();
  if (existingManifestCount === 0) {
    const VESSELS = ['SB GEMINI/59', 'SB GEMINI 58', 'SB GLOBE 82', 'SB GEMINI/57', 'SB Globe 81', 'SB GEMINI / 55', 'SB GLOBE/80', 'LENA / 333', 'SB GEMINI/53', 'SB GARDENIA/46', 'SB GLOBE/61', 'SB GEMINI/62'];
    const weekNumbers = [30, 29, 28, 27, 26, 25, 23, 22, 15, 13, 7, 20, 18, 16, 11, 9, 5, 3, 32, 31];
    let containerSeq = 790000;

    for (let i = 0; i < weekNumbers.length; i++) {
      const week = weekNumbers[i];
      // Roughly place week N in 2026 by offsetting from today; recent weeks close to now, older ones further back
      const weeksBack = 30 - week + (week > 30 ? -2 : 0);
      const reportedKgn = daysAgo(weeksBack * 7);
      const reportedMby = daysAgo(Math.max(0, weeksBack * 7 - 2));
      containerSeq += Math.floor(Math.random() * 300) + 50;
      const status = Math.random() > 0.85 ? 'RECEIVED' : 'PENDING';

      await prisma.manifest.create({
        data: {
          groupLabel: `2026-WEEK${week}`,
          billOfLading: `SMLU9${100000 + Math.floor(Math.random() * 90000)}A / HBL${200000 + Math.floor(Math.random() * 20000)}`,
          reportedDateKgn: reportedKgn,
          reportedDateMby: reportedMby,
          containerNumber: `SMLU${containerSeq}-${Math.floor(Math.random() * 9)}`,
          vessel: randomFrom(VESSELS),
          portOfLading: Math.random() > 0.1 ? 'Miami' : 'Kingston',
          status,
          createdAt: reportedKgn,
        },
      });
    }
  }

  // Sample warehouse receipts + scanned items for the admin Warehouse Scans screen
  const existingReceiptCount = await prisma.warehouseReceipt.count();
  if (existingReceiptCount === 0 && allSampleCustomers.length > 0) {
    const COURIERS_WH = ['Amazon Logistics (TBA)', 'USPS', 'SPEEDX', 'GOFO EXPRESS', 'UPS', 'FEDEX'];
    const existingBatches = await prisma.batch.findMany({ take: 5 });
    const receiptDaysAgo = [1, 2, 5, 6, 7, 8, 9, 11, 12, 16, 18, 21, 23, 28, 30];

    for (let r = 0; r < receiptDaysAgo.length; r++) {
      const dAgo = receiptDaysAgo[r];
      const receiptDate = daysAgo(dAgo);
      const label = `AIR - ${receiptDate.toLocaleDateString('en-US', { day: '2-digit' })} ${receiptDate.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()} ${receiptDate.getFullYear()}`;
      const itemCount = 1 + Math.floor(Math.random() * 40);
      const assignedBatch = existingBatches.length > 0 && Math.random() > 0.5 ? randomFrom(existingBatches) : null;

      const receipt = await prisma.warehouseReceipt.create({
        data: {
          label,
          batchId: assignedBatch?.id,
          createdAt: receiptDate,
          updatedAt: receiptDate,
        },
      });

      for (let i = 0; i < itemCount; i++) {
        const cust = randomFrom(allSampleCustomers);
        const courier = randomFrom(COURIERS_WH);
        const trackingPrefix = courier.startsWith('Amazon') ? 'TBA' : courier === 'USPS' ? '420333' : courier === 'GOFO EXPRESS' ? 'GFUS' : courier === 'UPS' ? '1Z' : courier === 'FEDEX' ? '' : 'SPXMIA';
        await prisma.warehouseScanItem.create({
          data: {
            receiptId: receipt.id,
            customerName: cust.name,
            trackingNumber: `${trackingPrefix}${Math.floor(100000000 + Math.random() * 899999999)}`,
            courier,
            phone: cust.phone,
            email: cust.email,
            dateReceived: new Date(receiptDate.getTime() + Math.random() * 8 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  // Sample delivered/collected shipments + Payment ledger entries for the admin Reports screen
  const existingPaymentCount = await prisma.payment.count();
  if (existingPaymentCount === 0 && allSampleCustomers.length > 0) {
    const reportBatches = await prisma.batch.findMany({ take: 6 });
    const PAYMENT_TYPES_SEED = ['Cash', 'Credit Card', 'Bank Transfer', 'Cheque', 'Paid in USD'];

    // A stack of already-collected shipments with a mix of fully-paid and partially-paid balances,
    // spread over the last month so the Outstanding Payment Report(s) have real rows to show.
    for (let i = 0; i < 24; i++) {
      const cust = randomFrom(allSampleCustomers);
      const batch = reportBatches.length > 0 ? randomFrom(reportBatches) : null;
      const totalUSD = Math.round((100 + Math.random() * 3000) * 100) / 100;
      const fullyPaid = Math.random() > 0.35;
      const amountPaid = fullyPaid ? totalUSD : Math.round(totalUSD * (0.4 + Math.random() * 0.5) * 100) / 100;
      const daysBackShip = Math.floor(Math.random() * 28) + 1;
      const shipDate = daysAgo(daysBackShip);

      const shipment = await prisma.shipment.create({
        data: {
          trackingNumber: `RPT-${Date.now()}-${i}-${Math.floor(Math.random() * 100000)}`,
          userId: cust.id,
          type: randomFrom(['AIR', 'SEA', 'GROUND']),
          status: 'DELIVERED',
          origin: 'Miami, FL, USA',
          destination: 'Kingston, Jamaica',
          weight: Math.round(Math.random() * 15 * 100) / 100,
          description: 'Collected item',
          itemCount: 1 + Math.floor(Math.random() * 5),
          pickupLocation: randomFrom(['Freeport', 'Kingston', 'Montego Bay', 'May Pen', 'Ocho Rios']),
          batchId: batch?.id,
          totalUSD,
          totalJMD: Math.round(totalUSD * 158 * 100) / 100,
          amountPaid,
          deliveredAt: shipDate,
          createdAt: shipDate,
        },
      });

      // Log the payment(s) that got this shipment to its current amountPaid
      await prisma.payment.create({
        data: {
          shipmentId: shipment.id,
          amount: amountPaid,
          paymentType: randomFrom(PAYMENT_TYPES_SEED),
          referenceNumber: Math.random() > 0.3 ? String(Math.floor(100000000 + Math.random() * 899999999)) : undefined,
          comment: '.',
          createdAt: new Date(shipDate.getTime() + Math.random() * 20 * 60 * 60 * 1000),
        },
      });
    }

    // A couple of payments dated today so the Transaction Report ("End of day") has rows by default
    const todaysBatch = reportBatches.length > 0 ? reportBatches[0] : null;
    for (let i = 0; i < 2; i++) {
      const cust = randomFrom(allSampleCustomers);
      const totalUSD = Math.round((500 + Math.random() * 4000) * 100) / 100;
      const shipment = await prisma.shipment.create({
        data: {
          trackingNumber: `RPT-TODAY-${Date.now()}-${i}`,
          userId: cust.id,
          type: 'AIR',
          status: 'DELIVERED',
          origin: 'Miami, FL, USA',
          destination: 'Kingston, Jamaica',
          itemCount: 1 + Math.floor(Math.random() * 3),
          pickupLocation: 'Kingston',
          batchId: todaysBatch?.id,
          totalUSD,
          totalJMD: Math.round(totalUSD * 158 * 100) / 100,
          amountPaid: totalUSD,
          deliveredAt: new Date(),
        },
      });
      await prisma.payment.create({
        data: {
          shipmentId: shipment.id,
          amount: totalUSD,
          paymentType: i === 0 ? 'Credit Card' : 'Cash',
          referenceNumber: i === 0 ? String(Math.floor(100000000000 + Math.random() * 899999999999)) : 'Paid in USD',
          comment: '.',
          createdAt: new Date(),
        },
      });
    }
  }

  // Sample Roles + staff Users for the admin Settings screen
  const existingRoleCount = await prisma.role.count();
  if (existingRoleCount === 0) {
    const roleDefs = [
      { name: 'Super Administrator', description: 'Full system access — manages users, roles, financials and all platform settings.' },
      { name: 'Administrator', description: 'Manages day-to-day operations — batches, freight, manifests and warehouse scans.' },
      { name: 'User', description: 'General staff access with limited administrative permissions.' },
      { name: 'Accounts', description: 'Handles payments, invoicing and the Business Journal ledger.' },
      { name: 'Customer', description: 'Storefront customer account — tracks shipments and manages their own profile.' },
      { name: 'Driver', description: 'Pickup and delivery driver — updates shipment status from the field.' },
    ];
    for (const r of roleDefs) {
      await prisma.role.upsert({ where: { name: r.name }, update: {}, create: r });
    }
  }

  const existingStaffCount = await prisma.user.count({ where: { role: 'ADMIN', NOT: { email: 'admin@rxllogistics.com' } } });
  if (existingStaffCount === 0) {
    const staffPassword = await bcrypt.hash('Staff123!', 12);
    const staffDefs: { name: string; email: string; userType: string; officeLocation: string; city: string }[] = [
      { name: 'Rayon Excell', email: 'rayon@rxllogistics.com', userType: 'Super Administrator', officeLocation: 'Freeport', city: 'Montego Bay' },
      { name: 'Petagaye Excell', email: 'petagaye@rxllogistics.com', userType: 'Super Administrator', officeLocation: 'Freeport', city: 'Montego Bay' },
      { name: 'Camalo Rhoden', email: 'camalo@rxllogistics.com', userType: 'Super Administrator', officeLocation: 'Kingston', city: 'Kingston' },
      { name: 'Bisnorth Headley', email: 'bisnorth@rxllogistics.com', userType: 'Super Administrator', officeLocation: 'Freeport', city: 'Montego Bay' },
      { name: 'Richard Excell', email: 'richard@rxllogistics.com', userType: 'Super Administrator', officeLocation: 'Kingston', city: 'Kingston' },
      { name: 'Shanice Grant', email: 'shanice.grant@rxllogistics.com', userType: 'Super Administrator', officeLocation: 'Ironshore', city: 'Montego Bay' },
      { name: 'Delroy Foster', email: 'delroy.foster@rxllogistics.com', userType: 'Super Administrator', officeLocation: 'Freeport', city: 'Montego Bay' },
      { name: 'Kimberly Reid', email: 'kimberly.reid@rxllogistics.com', userType: 'Administrator', officeLocation: 'Kingston', city: 'Kingston' },
      { name: 'Nadine Clarke', email: 'nadine.clarke@rxllogistics.com', userType: 'Accounts', officeLocation: 'Freeport', city: 'Montego Bay' },
      { name: 'Simone Bailey', email: 'simone.bailey@rxllogistics.com', userType: 'Accounts', officeLocation: 'Kingston', city: 'Kingston' },
      { name: 'Ann-Marie Powell', email: 'annmarie.powell@rxllogistics.com', userType: 'Accounts', officeLocation: 'Freeport', city: 'Montego Bay' },
      { name: 'Shemar Campbell', email: 'shemar.campbell@rxllogistics.com', userType: 'Driver', officeLocation: 'Freeport', city: 'Montego Bay' },
      { name: 'Owen Dunkley', email: 'owen.dunkley@rxllogistics.com', userType: 'Driver', officeLocation: 'Kingston', city: 'Kingston' },
      { name: 'Ricardo Morgan', email: 'ricardo.morgan@rxllogistics.com', userType: 'Driver', officeLocation: 'Freeport', city: 'Montego Bay' },
      { name: 'Rohan Wright', email: 'rohan.wright@rxllogistics.com', userType: 'Driver', officeLocation: 'May Pen', city: 'May Pen' },
      { name: 'Damion Hylton', email: 'damion.hylton@rxllogistics.com', userType: 'Driver', officeLocation: 'Freeport', city: 'Montego Bay' },
    ];

    for (let i = 0; i < staffDefs.length; i++) {
      const s = staffDefs[i];
      await prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: {
          name: s.name,
          email: s.email,
          password: staffPassword,
          role: 'ADMIN',
          userType: s.userType,
          officeLocation: s.officeLocation,
          city: s.city,
          country: 'Jamaica',
          phone: randomPhone(),
          status: 'ACTIVE',
          lastActiveAt: daysAgo(Math.random() * 10),
        },
      });
    }
  }

  // Sample bulletins for the admin Bulletins Management screen
  const existingBulletinCount = await prisma.bulletin.count();
  if (existingBulletinCount === 0) {
    const bulletinDefs: { title: string; message: string; status: string; updatedAt: string }[] = [
      { title: 'Holiday Hours — Independence Day', message: 'Our Freeport and Kingston offices will be closed Monday, August 3 for Independence Day. Warehouse pickups resume Tuesday, August 4 at normal hours.', status: 'ACTIVE', updatedAt: '2026-07-27T14:10:00' },
      { title: 'Air Shipment Delay Notice', message: 'Due to weather over Miami, this week\'s air shipment is delayed by approximately 2 days. We\'ll update tracking as soon as the batch clears customs.', status: 'INACTIVE', updatedAt: '2026-07-20T09:05:00' },
      { title: 'New Invoice Upload Feature', message: 'You can now upload your purchase invoice directly from your dashboard when submitting a package. This speeds up customs processing significantly.', status: 'ACTIVE', updatedAt: '2026-07-14T11:30:00' },
      { title: 'Rate Adjustment Notice', message: 'Effective August 1, air freight rates will adjust to reflect current fuel surcharges. Existing batches in transit are not affected.', status: 'INACTIVE', updatedAt: '2026-06-29T16:45:00' },
      { title: 'Warehouse Consolidation Now Available', message: 'Combine multiple online orders into a single shipment at our Miami warehouse to save on freight costs. Ask our team for details.', status: 'ACTIVE', updatedAt: '2026-06-15T10:00:00' },
      { title: 'Scheduled Maintenance — Customer Portal', message: 'The customer tracking portal will be briefly unavailable this Sunday from 2am-4am EST for scheduled maintenance.', status: 'INACTIVE', updatedAt: '2026-05-30T08:20:00' },
      { title: 'Sea Freight Booking Deadline', message: 'Reminder: items must be received at our warehouse by Wednesday each week to make that week\'s sea freight container.', status: 'ACTIVE', updatedAt: '2026-05-18T13:15:00' },
      { title: 'Easter Weekend Schedule', message: 'Our offices will observe modified hours over the Easter weekend. Warehouse scans will continue as normal on Good Friday.', status: 'INACTIVE', updatedAt: '2026-04-02T09:00:00' },
      { title: 'New Pickup Location — May Pen', message: 'We\'ve opened a new customer pickup location in May Pen. Select it at checkout or when booking your next shipment.', status: 'ACTIVE', updatedAt: '2026-03-10T12:00:00' },
      { title: 'Customs Documentation Reminder', message: 'Please ensure all high-value items include a purchase invoice. Packages without documentation may experience customs delays.', status: 'INACTIVE', updatedAt: '2026-02-14T15:30:00' },
      { title: 'Valentine\'s Shipping Promotion', message: 'Ship your Valentine\'s gifts for just $2/lb! Promotion runs January 28 through February 7.', status: 'INACTIVE', updatedAt: '2026-01-28T12:05:00' },
      { title: 'New Year Office Closure', message: 'RXL Logistics offices will be closed January 1 for the New Year holiday. Normal operations resume January 2.', status: 'INACTIVE', updatedAt: '2025-12-30T09:00:00' },
      { title: 'App Update — Track Multiple Packages', message: 'Our mobile app now supports tracking multiple packages at once from your dashboard home screen.', status: 'INACTIVE', updatedAt: '2025-11-20T10:45:00' },
      { title: 'Welcome to RXL Logistics', message: 'Thanks for joining RXL Logistics! Track your packages, manage payments, and get shipping updates all from your dashboard.', status: 'INACTIVE', updatedAt: '2025-09-01T09:00:00' },
    ];
    for (const b of bulletinDefs) {
      await prisma.bulletin.create({ data: { title: b.title, message: b.message, status: b.status, updatedAt: new Date(b.updatedAt) } });
    }
  }

  // Sample advertisements for the admin Advertisement Management screen
  const existingAdCount = await prisma.advertisement.count();
  if (existingAdCount === 0) {
    const adDefs: { title: string | null; message: string; status: string; updatedAt: string }[] = [
      { title: null, message: 'Ships direct from RXL Logistics Warehouse. https://shopfnds.com/', status: 'ACTIVE', updatedAt: '2025-07-14T21:29:32' },
      { title: 'Air Shipment Promotion', message: "Love is in the air… and so are your packages! ✈️❤️ Ship your Valentine's gifts for just $2/lb! Promotion starts from January 28 - February 7, 2025.", status: 'INACTIVE', updatedAt: '2025-01-28T12:05:02' },
      { title: 'Introducing our Warehouse Consolidation Services', message: 'Why Choose RXL Logistics We Provide;  •  Effortless Shipping: Our full-service warehouse consolidation combines your orders and optimizes freight for air or sea, saving you time and money.  •  Complete Visibility: Track your shipments every step of the way with our user-friendly software.  •  Boost Efficiency: Focus on your core business while we handle the logistics. Get a Quote & Experience Smoother Shipping with RXL Logistics For more information email us at  info@rxllogistics.com', status: 'ACTIVE', updatedAt: '2024-04-07T15:37:36' },
      { title: null, message: '', status: 'INACTIVE', updatedAt: '2024-04-05T12:12:18' },
      { title: 'Invoice upload video instructions.', message: 'Invoice upload demo. App demo https://youtube.com/shorts/wBZRu1aFenQ?feature=share Website demo https://youtu.be/XQnRTMA4QWk', status: 'ACTIVE', updatedAt: '2023-11-25T09:15:32' },
      { title: 'Invoice upload instruction', message: 'Invoice upload instructions App demo https://youtube.com/shorts/wBZRu1aFenQ?feature=share Website demo https://youtu.be/XQnRTMA4QWk', status: 'INACTIVE', updatedAt: '2023-11-25T09:13:45' },
      { title: 'RXL Logistics', message: 'https://rxllogistics.com/', status: 'ACTIVE', updatedAt: '2023-08-13T10:36:09' },
      { title: 'Warehouse images', message: 'The operation', status: 'ACTIVE', updatedAt: '2023-05-30T22:35:20' },
      { title: 'Wrap City', message: 'For all your: Banners • Posters • Signs • Vehicle Wraps • Floor Graphics • Stickers • Decals & More. Located - Lot H6 Coconut Drive, Freeport, Montego Bay, Jamaica https://www.wrapcityjm.com', status: 'INACTIVE', updatedAt: '2023-05-30T22:02:15' },
      { title: 'Check out latest gadgets', message: 'Download stock pictures of Sale on Depositphotos ✓ Photo stock for commercial use - millions of high-quality, royalty-free photos & images.', status: 'INACTIVE', updatedAt: '2023-05-30T21:57:28' },
      { title: 'Refer a Friend Promotion', message: 'Refer a friend to RXL Logistics and you both get $5 off your next shipment once they complete their first pickup.', status: 'INACTIVE', updatedAt: '2023-03-15T10:00:00' },
      { title: 'Now Shipping to Negril & Savanna-la-Mar', message: 'We\'ve expanded pickup locations to cover Negril and Savanna-la-Mar. Select your nearest location when booking.', status: 'INACTIVE', updatedAt: '2023-01-10T09:00:00' },
    ];
    for (const a of adDefs) {
      await prisma.advertisement.create({ data: { title: a.title || undefined, message: a.message, status: a.status, updatedAt: new Date(a.updatedAt) } });
    }
  }

  // Historical orders so the admin Dashboard's Quarterly Revenue chart has something to show.
  // Totals loosely trend up then down — realistic shape, not tied to real accounting.
  const QUARTER_REVENUE: [string, number][] = [
    ['2018-08-15', 5_000_000], ['2018-11-15', 9_000_000],
    ['2019-02-15', 20_000_000], ['2019-05-15', 20_000_000], ['2019-08-15', 26_000_000], ['2019-11-15', 23_000_000],
    ['2020-02-15', 28_000_000], ['2020-05-15', 36_000_000], ['2020-08-15', 25_000_000], ['2020-11-15', 20_000_000],
    ['2021-02-15', 28_000_000], ['2021-05-15', 31_000_000], ['2021-08-15', 47_000_000], ['2021-11-15', 43_000_000],
    ['2022-02-15', 48_000_000], ['2022-05-15', 50_000_000], ['2022-08-15', 50_000_000], ['2022-11-15', 43_000_000],
    ['2023-02-15', 50_000_000], ['2023-05-15', 51_000_000], ['2023-08-15', 58_000_000], ['2023-11-15', 62_000_000],
    ['2024-02-15', 52_000_000], ['2024-05-15', 44_000_000], ['2024-08-15', 38_000_000], ['2024-11-15', 39_000_000],
    ['2025-02-15', 41_000_000], ['2025-05-15', 36_000_000], ['2025-08-15', 30_000_000], ['2025-11-15', 26_000_000],
    ['2026-02-15', 22_000_000], ['2026-05-15', 29_000_000], ['2026-07-20', 6_000_000],
  ];

  const allProducts = await prisma.product.findMany();
  const allCustomers = await prisma.user.findMany({ where: { role: 'CUSTOMER' } });
  const existingOrderCount = await prisma.order.count();

  if (existingOrderCount === 0 && allProducts.length > 0 && allCustomers.length > 0) {
    for (const [dateStr, targetTotal] of QUARTER_REVENUE) {
      const ordersThisQuarter = 2 + Math.floor(Math.random() * 3);
      let remaining = targetTotal;
      for (let i = 0; i < ordersThisQuarter; i++) {
        const isLast = i === ordersThisQuarter - 1;
        const share = isLast ? remaining : Math.round(remaining * (0.2 + Math.random() * 0.3));
        remaining -= share;
        const product = randomFrom(allProducts);
        const customer = randomFrom(allCustomers);
        const total = Math.max(share, 10);
        await prisma.order.create({
          data: {
            userId: customer.id,
            status: 'DELIVERED',
            subtotal: total,
            shipping: 0,
            tax: 0,
            total,
            shippingAddress: `${customer.address || 'N/A'}, ${customer.city || ''}`,
            paymentMethod: 'card',
            paymentStatus: 'paid',
            createdAt: new Date(dateStr),
            items: { create: [{ productId: product.id, quantity: 1, price: product.price }] },
          },
        });
      }
    }
  }

  console.log('✅ Seed complete!');
  console.log(`   Admin: admin@rxllogistics.com / admin123`);
  console.log(`   Demo:  demo@rxllogistics.com / customer123`);
  console.log(`   Sample customers: 40 (password: Sample123!)`);
  console.log(`   Tracking: RXL-2024-AIR-001 | RXL-2024-SEA-002`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
