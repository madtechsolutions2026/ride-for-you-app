const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedAll() {
  console.log('🌱 Starting comprehensive sample data seed...');

  // 1. Clean existing records in dependency order
  console.log('Clearing existing records...');
  await prisma.serviceNote.deleteMany({});
  await prisma.servicePart.deleteMany({});
  await prisma.serviceTicket.deleteMany({});
  await prisma.servicePerson.deleteMany({});
  await prisma.supportTicket.deleteMany({});
  await prisma.bikeDeploymentLog.deleteMany({});
  await prisma.damageReport.deleteMany({});
  await prisma.recoveryJob.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.weeklyInvoice.deleteMany({});
  await prisma.rental.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.salary.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.bike.deleteMany({});
  await prisma.rentalPlan.deleteMany({});
  await prisma.bikeModel.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.kycVerification.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.hub.deleteMany({});
  await prisma.swapStation.deleteMany({});

  console.log('✅ Cleaned up old records.');

  // 2. Seed Hubs
  console.log('Seeding Hubs & Swap Stations...');
  const kondapurHub = await prisma.hub.create({
    data: {
      id: 'hub_kondapur',
      name: 'Ride For You – Kondapur Hub',
      address: 'RTO Office Road, Near Botanical Garden, Kondapur, Hyderabad',
      lat: 17.462,
      lng: 78.356,
      city: 'Hyderabad',
      openTime: '09:00',
      closeTime: '21:00',
      contactPhone: '+914012345678',
    },
  });

  const hitechHub = await prisma.hub.create({
    data: {
      id: 'hub_hitech',
      name: 'Ride For You – Hitech Metro Hub',
      address: 'Near Hitech City Metro Station, Madhapur, Hyderabad',
      lat: 17.448,
      lng: 78.378,
      city: 'Hyderabad',
      openTime: '08:00',
      closeTime: '22:00',
      contactPhone: '+914012345679',
    },
  });

  const gachibowliHub = await prisma.hub.create({
    data: {
      id: 'hub_gachibowli',
      name: 'Ride For You – Gachibowli Hub',
      address: 'Financial District, Near Wipro Circle, Gachibowli, Hyderabad',
      lat: 17.432,
      lng: 78.345,
      city: 'Hyderabad',
      openTime: '08:30',
      closeTime: '21:30',
      contactPhone: '+914012345680',
    },
  });

  await prisma.swapStation.createMany({
    data: [
      {
        id: 'sw_hitech_metro',
        name: 'Hitech City Metro Swap Point',
        address: 'Near Pillar 1240, Hitech City Main Rd',
        lat: 17.4435,
        lng: 78.3772,
        openTime: '06:00',
        closeTime: '23:00',
      },
      {
        id: 'sw_cyber_towers',
        name: 'Madhapur Cyber Towers Swap Point',
        address: 'Opp. Cyber Gateway, Madhapur',
        lat: 17.4504,
        lng: 78.3808,
        openTime: '06:00',
        closeTime: '23:00',
      },
      {
        id: 'sw_gachibowli',
        name: 'Gachibowli Bio-Diversity Swap Point',
        address: 'Near Bio-Diversity Junction, Gachibowli',
        lat: 17.4334,
        lng: 78.3668,
        openTime: '06:00',
        closeTime: '23:00',
      },
    ],
  });

  // 3. Seed Employees & Staff
  console.log('Seeding Employees & Organization Hierarchy...');
  const empSuperAdmin = await prisma.employee.create({
    data: {
      id: 'emp_super_admin',
      name: 'Rajesh Sharma',
      phone: '+919876543210',
      email: 'rajesh.admin@rideforyou.in',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  const empMgrKondapur = await prisma.employee.create({
    data: {
      id: 'emp_mgr_kondapur',
      name: 'Vikram Reddy',
      phone: '+919876543211',
      email: 'vikram.reddy@rideforyou.in',
      role: 'HUB_MANAGER',
      hubId: kondapurHub.id,
      status: 'ACTIVE',
    },
  });

  const empMgrHitech = await prisma.employee.create({
    data: {
      id: 'emp_mgr_hitech',
      name: 'Priya Singh',
      phone: '+919876543212',
      email: 'priya.singh@rideforyou.in',
      role: 'HUB_MANAGER',
      hubId: hitechHub.id,
      status: 'ACTIVE',
    },
  });

  // Link hub managers
  await prisma.hub.update({ where: { id: kondapurHub.id }, data: { managerId: empMgrKondapur.id } });
  await prisma.hub.update({ where: { id: hitechHub.id }, data: { managerId: empMgrHitech.id } });

  const empStaff1 = await prisma.employee.create({
    data: {
      id: 'emp_staff_1',
      name: 'Anish Verma',
      phone: '+919876543213',
      email: 'anish.verma@rideforyou.in',
      role: 'STAFF',
      hubId: kondapurHub.id,
      status: 'ACTIVE',
    },
  });

  const empStaff2 = await prisma.employee.create({
    data: {
      id: 'emp_staff_2',
      name: 'Karthik Rao',
      phone: '+919876543214',
      email: 'karthik.rao@rideforyou.in',
      role: 'STAFF',
      hubId: hitechHub.id,
      status: 'ACTIVE',
    },
  });

  const empTech1 = await prisma.employee.create({
    data: {
      id: 'emp_tech_1',
      name: 'Suresh Kumar',
      phone: '+919876543215',
      email: 'suresh.kumar@rideforyou.in',
      role: 'SERVICE_PERSON',
      hubId: kondapurHub.id,
      status: 'ACTIVE',
    },
  });

  const empTech2 = await prisma.employee.create({
    data: {
      id: 'emp_tech_2',
      name: 'Mohammad Ali',
      phone: '+919876543216',
      email: 'm.ali@rideforyou.in',
      role: 'SERVICE_PERSON',
      hubId: hitechHub.id,
      status: 'ACTIVE',
    },
  });

  // Seed ServicePerson table
  const techSuresh = await prisma.servicePerson.create({
    data: {
      id: 'tech_suresh',
      name: 'Suresh Kumar',
      phone: '+919876543215',
      specialization: 'Battery & Motor Electricals',
      status: 'AVAILABLE',
      hubId: kondapurHub.id,
    },
  });

  const techAli = await prisma.servicePerson.create({
    data: {
      id: 'tech_ali',
      name: 'Mohammad Ali',
      phone: '+919876543216',
      specialization: 'Brakes, Suspension & Frame',
      status: 'BUSY',
      hubId: hitechHub.id,
    },
  });

  // Seed Admin & Staff Users (for dashboard login)
  await prisma.user.createMany({
    data: [
      {
        id: 'usr_admin',
        phone: '+919876543210',
        fullName: 'Rajesh Sharma',
        email: 'rajesh.admin@rideforyou.in',
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
        kycStatus: 'APPROVED',
      },
      {
        id: 'usr_mgr_kondapur',
        phone: '+919876543211',
        fullName: 'Vikram Reddy',
        email: 'vikram.reddy@rideforyou.in',
        role: 'EXECUTIVE',
        assignedHubId: kondapurHub.id,
        accountStatus: 'ACTIVE',
        kycStatus: 'APPROVED',
      },
      {
        id: 'usr_mgr_hitech',
        phone: '+919876543212',
        fullName: 'Priya Singh',
        email: 'priya.singh@rideforyou.in',
        role: 'SUPPORT',
        assignedHubId: hitechHub.id,
        accountStatus: 'ACTIVE',
        kycStatus: 'APPROVED',
      },
    ],
  });

  // 4. Seed Rider Users
  console.log('Seeding Riders & KYC profiles...');
  const riderRahul = await prisma.user.create({
    data: {
      id: 'rider_rahul',
      phone: '+919999911111',
      fullName: 'Rahul Sharma',
      email: 'rahul.sharma@gmail.com',
      city: 'Hyderabad',
      role: 'RIDER',
      accountStatus: 'ACTIVE',
      kycStatus: 'APPROVED',
    },
  });

  await prisma.kycVerification.create({
    data: {
      userId: riderRahul.id,
      status: 'APPROVED',
      fullName: 'Rahul Sharma',
      aadhaarNumber: 'XXXX-XXXX-8921',
      panNumber: 'ABCPS1234K',
      address: 'Plot 42, Silicon Valley Colony, Madhapur, Hyderabad',
      reviewedBy: 'usr_admin',
      reviewedAt: new Date(),
    },
  });

  const riderSneha = await prisma.user.create({
    data: {
      id: 'rider_sneha',
      phone: '+919999922222',
      fullName: 'Sneha Patel',
      email: 'sneha.patel@gmail.com',
      city: 'Hyderabad',
      role: 'RIDER',
      accountStatus: 'ACTIVE',
      kycStatus: 'APPROVED',
    },
  });

  const riderAmit = await prisma.user.create({
    data: {
      id: 'rider_amit',
      phone: '+919999933333',
      fullName: 'Amit Gupta',
      email: 'amit.gupta@outlook.com',
      city: 'Hyderabad',
      role: 'RIDER',
      accountStatus: 'ACTIVE',
      kycStatus: 'SUBMITTED',
    },
  });

  await prisma.kycVerification.create({
    data: {
      userId: riderAmit.id,
      status: 'SUBMITTED',
      fullName: 'Amit Gupta',
      aadhaarNumber: 'XXXX-XXXX-3419',
      panNumber: 'BGFPG5678L',
      address: 'Flat 302, Green Hills Apt, Kondapur, Hyderabad',
    },
  });

  // 5. Seed Bike Models, Pricing Plans & Fleet Units
  console.log('Seeding Bike Fleet & Models...');
  const sprintoModel = await prisma.bikeModel.create({
    data: {
      id: 'bm_sprinto_hs',
      name: 'SPRINTO HS',
      category: 'SWAP',
      topSpeedKmph: 45,
      rangeKm: 90,
      requiresLicense: false,
      chargerIncluded: false,
    },
  });

  const evtricModel = await prisma.bikeModel.create({
    data: {
      id: 'bm_evtric',
      name: 'EVTRIC',
      category: 'SWAP',
      topSpeedKmph: 30,
      rangeKm: 90,
      requiresLicense: false,
      chargerIncluded: false,
    },
  });

  const halaModel = await prisma.bikeModel.create({
    data: {
      id: 'bm_hala_ckd',
      name: 'HALA CKD',
      category: 'SWAP',
      topSpeedKmph: 35,
      rangeKm: 90,
      requiresLicense: false,
      chargerIncluded: false,
    },
  });

  const homeModel = await prisma.bikeModel.create({
    data: {
      id: 'bm_home_pro_x1',
      name: 'HOME PRO X1',
      category: 'HOME',
      topSpeedKmph: 60,
      rangeKm: 130,
      requiresLicense: true,
      chargerIncluded: true,
    },
  });

  // Rental plans
  const sprintoPlanWeek = await prisma.rentalPlan.create({
    data: { modelId: sprintoModel.id, duration: 'WEEK', price: 1645, deposit: 1500 },
  });
  await prisma.rentalPlan.create({
    data: { modelId: sprintoModel.id, duration: 'MONTH', price: 5999, deposit: 2000 },
  });

  const evtricPlanWeek = await prisma.rentalPlan.create({
    data: { modelId: evtricModel.id, duration: 'WEEK', price: 1610, deposit: 1500 },
  });

  const homePlanWeek = await prisma.rentalPlan.create({
    data: { modelId: homeModel.id, duration: 'WEEK', price: 1925, deposit: 2000 },
  });

  // Physical Bikes
  const bike1 = await prisma.bike.create({
    data: {
      id: 'bike_sprinto_1001',
      modelId: sprintoModel.id,
      hubId: kondapurHub.id,
      registrationNumber: 'TS09EA1001',
      colour: 'Teal',
      batteryPercent: 98,
      odometerKm: 1350,
      status: 'RENTED',
    },
  });

  const bike2 = await prisma.bike.create({
    data: {
      id: 'bike_evtric_1002',
      modelId: evtricModel.id,
      hubId: kondapurHub.id,
      registrationNumber: 'TS09EA1002',
      colour: 'Graphite',
      batteryPercent: 100,
      odometerKm: 780,
      status: 'AVAILABLE',
    },
  });

  const bike3 = await prisma.bike.create({
    data: {
      id: 'bike_hala_1003',
      modelId: halaModel.id,
      hubId: kondapurHub.id,
      registrationNumber: 'TS09EA1003',
      colour: 'Pearl White',
      batteryPercent: 85,
      odometerKm: 2150,
      status: 'MAINTENANCE',
    },
  });

  const bike4 = await prisma.bike.create({
    data: {
      id: 'bike_evtric_1004',
      modelId: evtricModel.id,
      hubId: hitechHub.id,
      registrationNumber: 'TS09EA1004',
      colour: 'Midnight Blue',
      batteryPercent: 95,
      odometerKm: 940,
      status: 'AVAILABLE',
    },
  });

  const bike5 = await prisma.bike.create({
    data: {
      id: 'bike_home_1009',
      modelId: homeModel.id,
      hubId: hitechHub.id,
      registrationNumber: 'TS10EB1009',
      colour: 'Pearl White',
      batteryPercent: 100,
      odometerKm: 420,
      status: 'RESERVED',
    },
  });

  // Extra bikes for available inventory
  await prisma.bike.createMany({
    data: [
      {
        id: 'bike_sprinto_1005',
        modelId: sprintoModel.id,
        hubId: hitechHub.id,
        registrationNumber: 'TS09EA1005',
        colour: 'Teal',
        batteryPercent: 100,
        odometerKm: 600,
        status: 'AVAILABLE',
      },
      {
        id: 'bike_sprinto_1006',
        modelId: sprintoModel.id,
        hubId: gachibowliHub.id,
        registrationNumber: 'TS09EA1006',
        colour: 'Graphite',
        batteryPercent: 92,
        odometerKm: 810,
        status: 'AVAILABLE',
      },
      {
        id: 'bike_home_1010',
        modelId: homeModel.id,
        hubId: gachibowliHub.id,
        registrationNumber: 'TS10EB1010',
        colour: 'Midnight Blue',
        batteryPercent: 100,
        odometerKm: 310,
        status: 'AVAILABLE',
      },
    ],
  });

  // 6. Seed Active Booking, Rental, Invoices & Payments (Single Active Booking demonstration)
  console.log('Seeding Live Booking & Active Rental...');
  const activeBooking = await prisma.booking.create({
    data: {
      id: 'bkg_active_1',
      reference: 'RFY-8H2K9',
      userId: riderRahul.id,
      modelId: sprintoModel.id,
      planId: sprintoPlanWeek.id,
      hubId: kondapurHub.id,
      status: 'HANDED_OVER',
      rentAmount: 1645,
      depositAmount: 1500,
      platformFee: 1500,
      totalAmount: 3345,
      reservedBikeId: bike1.id,
      startsAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  const activeRental = await prisma.rental.create({
    data: {
      id: 'rnt_active_1',
      bookingId: activeBooking.id,
      userId: riderRahul.id,
      bikeId: bike1.id,
      hubId: kondapurHub.id,
      status: 'ACTIVE',
      handoverById: 'usr_mgr_kondapur',
      handoverAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      expectedReturnAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      odometerStart: 1200,
    },
  });

  // Deployment Log for Handover
  await prisma.bikeDeploymentLog.create({
    data: {
      bikeId: bike1.id,
      hubId: kondapurHub.id,
      deployedByEmployeeId: empStaff1.id,
      riderId: riderRahul.id,
      bookingId: activeBooking.id,
      deployedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      odometerStart: 1200,
      conditionNotesOnDeploy: 'Vehicle thoroughly checked. Battery 100%, sanitized helmet & mobile mount provided.',
    },
  });

  // Weekly Invoices
  await prisma.weeklyInvoice.create({
    data: {
      rentalId: activeRental.id,
      weekNumber: 1,
      periodStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      amount: 1645,
      status: 'PAID',
      dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.payment.create({
    data: {
      userId: riderRahul.id,
      bookingId: activeBooking.id,
      purpose: 'RENT',
      amount: 3345,
      provider: 'PHONEPE',
      status: 'SUCCESS',
      note: 'Initial Rental + Deposit for Sprinto HS',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  // Confirmed booking ready for handover
  const confirmedBooking = await prisma.booking.create({
    data: {
      id: 'bkg_confirmed_2',
      reference: 'RFY-4M9P2',
      userId: riderSneha.id,
      modelId: homeModel.id,
      planId: homePlanWeek.id,
      hubId: hitechHub.id,
      status: 'CONFIRMED',
      rentAmount: 1925,
      depositAmount: 2000,
      platformFee: 2000,
      totalAmount: 4125,
      reservedBikeId: bike5.id,
      startsAt: new Date(),
    },
  });

  await prisma.payment.create({
    data: {
      userId: riderSneha.id,
      bookingId: confirmedBooking.id,
      purpose: 'RENT',
      amount: 4125,
      provider: 'RAZORPAY',
      status: 'SUCCESS',
      note: 'Booking Home Pro X1 at Hitech Hub',
      createdAt: new Date(),
    },
  });

  // 7. Seed Attendance Records
  console.log('Seeding Attendance records...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const empList = [empSuperAdmin, empMgrKondapur, empMgrHitech, empStaff1, empStaff2, empTech1, empTech2];

  for (const emp of empList) {
    const checkIn = new Date(today);
    checkIn.setHours(8, 45 + Math.floor(Math.random() * 20), 0);

    const checkOut = new Date(today);
    checkOut.setHours(18, Math.floor(Math.random() * 30), 0);

    await prisma.attendance.create({
      data: {
        employeeId: emp.id,
        date: today,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        status: 'PRESENT',
        note: 'On time morning shift',
      },
    });
  }

  // 8. Seed Salaries & Payroll Records
  console.log('Seeding Salaries & Payroll records...');
  const salaryData = [
    { emp: empSuperAdmin, base: 60000, bonus: 5000, ded: 0 },
    { emp: empMgrKondapur, base: 35000, bonus: 2500, ded: 500 },
    { emp: empMgrHitech, base: 35000, bonus: 2500, ded: 0 },
    { emp: empStaff1, base: 22000, bonus: 1000, ded: 0 },
    { emp: empStaff2, base: 22000, bonus: 1000, ded: 0 },
    { emp: empTech1, base: 25000, bonus: 2000, ded: 0 },
    { emp: empTech2, base: 25000, bonus: 2000, ded: 0 },
  ];

  // Month 8 (August - PAID)
  for (const s of salaryData) {
    const net = s.base + s.bonus - s.ded;
    await prisma.salary.create({
      data: {
        employeeId: s.emp.id,
        month: 8,
        year: 2026,
        baseSalary: s.base,
        bonuses: s.bonus,
        deductions: s.ded,
        netPaid: net,
        status: 'PAID',
        paidOn: new Date(2026, 7, 31),
      },
    });
  }

  // Month 9 (September - PENDING)
  for (const s of salaryData) {
    const net = s.base + s.bonus - s.ded;
    await prisma.salary.create({
      data: {
        employeeId: s.emp.id,
        month: 9,
        year: 2026,
        baseSalary: s.base,
        bonuses: s.bonus,
        deductions: s.ded,
        netPaid: net,
        status: 'PENDING',
      },
    });
  }

  // 9. Seed Financial Expenses (P&L Ledger)
  console.log('Seeding Operating Expenses...');
  await prisma.expense.createMany({
    data: [
      {
        category: 'RENT',
        amount: 45000,
        note: 'Kondapur EV Hub monthly property lease & maintenance',
        hubId: kondapurHub.id,
        date: new Date(2026, 8, 1),
      },
      {
        category: 'RENT',
        amount: 55000,
        note: 'Hitech Metro Hub primary facility commercial rent',
        hubId: hitechHub.id,
        date: new Date(2026, 8, 1),
      },
      {
        category: 'SALARY',
        amount: 250000,
        note: 'August 2026 Monthly Payroll Payout for all Hub staff & mechanics',
        date: new Date(2026, 7, 31),
      },
      {
        category: 'SERVICE',
        amount: 14200,
        note: 'Bulk purchase: 20 sets of ceramic brake pads & rear suspensions',
        hubId: kondapurHub.id,
        date: new Date(2026, 8, 3),
      },
      {
        category: 'MISC',
        amount: 5800,
        note: 'Hub CCTV security cloud backup & high-speed broadband connection',
        hubId: hitechHub.id,
        date: new Date(2026, 8, 2),
      },
    ],
  });

  // 10. Seed Service Module Tickets & Parts
  console.log('Seeding Service Tickets & Maintenance...');
  const srvTicket1 = await prisma.serviceTicket.create({
    data: {
      bikeId: bike3.id,
      reportedIssue: 'Front fork alignment off & headlight flickering intermittently',
      assignedServicePersonId: techSuresh.id,
      status: 'IN_PROGRESS',
      totalCost: 1150,
      scheduledTime: new Date(),
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  await prisma.servicePart.createMany({
    data: [
      {
        serviceTicketId: srvTicket1.id,
        partName: 'Front LED Headlight Unit',
        cost: 450,
        quantity: 1,
      },
      {
        serviceTicketId: srvTicket1.id,
        partName: 'Hydraulic Fork Oil Seal',
        cost: 350,
        quantity: 2,
      },
    ],
  });

  await prisma.serviceNote.create({
    data: {
      serviceTicketId: srvTicket1.id,
      note: 'Front fork disassembled. Replaced leaking oil seals and re-aligned. Checking electrical harness for headlight.',
    },
  });

  // Completed Service Ticket
  const srvTicket2 = await prisma.serviceTicket.create({
    data: {
      bikeId: bike4.id,
      reportedIssue: 'Rear brake shoes worn out and excessive chain slack',
      assignedServicePersonId: techAli.id,
      status: 'COMPLETED',
      totalCost: 850,
      startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      totalTimeTakenMinutes: 45,
    },
  });

  await prisma.servicePart.create({
    data: {
      serviceTicketId: srvTicket2.id,
      partName: 'High Performance Rear Brake Shoes',
      cost: 850,
      quantity: 1,
    },
  });

  await prisma.serviceNote.create({
    data: {
      serviceTicketId: srvTicket2.id,
      note: 'Replaced rear brake shoes. Cleaned drum assembly and tensioned drive chain. Test ride successful.',
    },
  });

  // 11. Seed Rider Support Tickets
  console.log('Seeding Rider Support Tickets...');
  await prisma.supportTicket.createMany({
    data: [
      {
        ticketNumber: 'TKT-1042',
        riderId: riderRahul.id,
        bookingId: activeBooking.id,
        category: 'BIKE_ISSUE',
        subject: 'Battery swap dock 3 barcode scanner not responding',
        description: 'Attempted to swap battery at Hitech City Metro Point at 8:30 AM. Dock #3 scanner was unresponsive.',
        status: 'OPEN',
      },
      {
        ticketNumber: 'TKT-1043',
        riderId: riderSneha.id,
        bookingId: confirmedBooking.id,
        category: 'PAYMENT',
        subject: 'Payment receipt confirmation for booking RFY-4M9P2',
        description: 'Paid via Razorpay UPI. Requesting invoice copy for platform fee and deposit payment.',
        status: 'IN_PROGRESS',
        adminNotes: 'Transaction verified with Razorpay payment ID pay_982341. PDF receipt sent to rider email.',
      },
      {
        ticketNumber: 'TKT-1044',
        riderId: riderRahul.id,
        category: 'OTHER',
        subject: 'Request for co-rider additional helmet',
        description: 'Can I collect an additional helmet from Kondapur Hub for my colleague?',
        status: 'RESOLVED',
        adminNotes: 'Approved. Handed over extra sanitized RFY branded helmet from Kondapur hub inventory.',
        resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ],
  });

  // 12. Seed Damage & Roadside Recovery
  console.log('Seeding Damage & Roadside Recovery jobs...');
  await prisma.damageReport.create({
    data: {
      rentalId: activeRental.id,
      bikeId: bike1.id,
      reportedById: 'usr_mgr_kondapur',
      severity: 'MINOR',
      description: 'Minor superficial scratch on lower battery door panel.',
      estimatedCost: 350,
      chargeStatus: 'WAIVED',
    },
  });

  await prisma.recoveryJob.create({
    data: {
      reference: 'REC-2049',
      bikeId: bike3.id,
      type: 'ROADSIDE',
      priority: 'HIGH',
      status: 'DISPATCHED',
      reportedByPhone: '+919999911111',
      locationText: 'Near Inorbit Mall Flyover, Madhapur',
      description: 'Puncture / slow air leak in rear tubeless tire. Rider parked safely on service road.',
      vanLabel: 'Van 01 - Hitech Quick Response',
      assignedToId: 'usr_mgr_kondapur',
      dispatchedAt: new Date(),
    },
  });

  console.log('🎉 All sample data seeded successfully!');
}

seedAll()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
