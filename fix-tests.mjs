import fs from 'fs';

function replaceFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  content = replacer(content);
  fs.writeFileSync(path, content, 'utf8');
}

replaceFile('apps/api/src/integration/configuration-assignment.integration.spec.ts', (content) => {
  content = content.replace('customers = new CustomersService(database, access);', 'customers = new CustomersService(database, access, {} as any);');
  content = content.replace(/quotations = new QuotationsService\(\n\s*database,\n\s*access,\n\s*new PdfService\(\),\n\s*\{ sendQuotation: vi\.fn\(\) \} as unknown as MailService,\n\s*configuration,\n\s*\);/g, 
  `quotations = new QuotationsService(
      database,
      access,
      new PdfService(),
      { sendQuotation: vi.fn() } as unknown as MailService,
      {} as any,
      configuration,
    );`);
  return content;
});

replaceFile('apps/api/src/integration/invoice-journey.integration.spec.ts', (content) => {
  content = content.replace('customers = new CustomersService(database, access);', 'customers = new CustomersService(database, access, {} as any);');
  content = content.replace(/quotations = new QuotationsService\(\n\s*database,\n\s*access,\n\s*new PdfService\(\),\n\s*\{ sendQuotation: vi\.fn\(\) \} as unknown as MailService,\n\s*configuration,\n\s*\);/g, 
  `quotations = new QuotationsService(
      database,
      access,
      new PdfService(),
      { sendQuotation: vi.fn() } as unknown as MailService,
      {} as any,
      configuration,
    );`);
  content = content.replace(/invoices = new InvoicesService\(\n\s*database,\n\s*access,\n\s*new PdfService\(\),\n\s*\{ sendInvoice: vi\.fn\(\) \} as unknown as MailService,\n\s*\{ put: vi\.fn\(\), get: vi\.fn\(\) \} as unknown as ObjectStore,\n\s*configuration,\n\s*\);/g, 
  `invoices = new InvoicesService(
      database,
      access,
      new PdfService(),
      { sendInvoice: vi.fn() } as unknown as MailService,
      { put: vi.fn(), get: vi.fn() } as unknown as ObjectStore,
      {} as any,
      configuration,
    );`);
  return content;
});

replaceFile('apps/api/src/integration/quotation-journey.integration.spec.ts', (content) => {
  content = content.replace('customers = new CustomersService(database, access);', 'customers = new CustomersService(database, access, {} as any);');
  content = content.replace(/quotations = new QuotationsService\(\n\s*database,\n\s*access,\n\s*new PdfService\(\),\n\s*\{ sendQuotation: vi\.fn\(\) \} as unknown as MailService,\n\s*configuration,\n\s*\);/g, 
  `quotations = new QuotationsService(
      database,
      access,
      new PdfService(),
      { sendQuotation: vi.fn() } as unknown as MailService,
      {} as any,
      configuration,
    );`);
  return content;
});

