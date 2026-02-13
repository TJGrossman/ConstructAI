import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { HardHat } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function CustomerPortalPage({
  params,
}: {
  params: { shareToken: string };
}) {
  const project = await prisma.project.findUnique({
    where: { shareToken: params.shareToken },
    include: {
      user: { select: { name: true, companyName: true, phone: true, email: true } },
      customer: true,
      estimates: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { number: "asc" },
      },
      changeOrders: {
        include: { lineItems: true },
        orderBy: { number: "asc" },
      },
      invoices: {
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { number: "asc" },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    sent: "bg-blue-100 text-blue-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2">
            <HardHat className="h-5 w-5" />
            <span className="font-bold">
              {project.user.companyName || project.user.name}
            </span>
          </div>
          <div className="text-right text-sm text-gray-500">
            {project.user.phone && <p>{project.user.phone}</p>}
            <p>{project.user.email}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="mt-1 text-gray-600">
            Prepared for: {project.customer.name}
          </p>
          {project.address && (
            <p className="text-sm text-gray-500">{project.address}</p>
          )}
        </div>

        {/* Estimates */}
        {project.estimates.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">Estimates</h2>
            {project.estimates.map((est) => (
              <div key={est.id} className="mb-4 rounded-lg border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="font-semibold">
                      Estimate #{est.number}: {est.title}
                    </h3>
                    <p className="text-sm text-gray-500">{formatDate(est.createdAt)}</p>
                  </div>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${statusColors[est.status] || ""}`}>
                    {est.status}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-6 py-2 font-medium">Description</th>
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Materials</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {est.lineItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-6 py-2">{item.description}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {item.timeHours && item.timeRate ? (
                            <span>{String(item.timeHours)} hrs @ {formatCurrency(String(item.timeRate))}/hr</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {item.materialsCost ? (
                            formatCurrency(String(item.materialsCost))
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(String(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="px-6 py-2 text-right text-gray-500">Subtotal</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(String(est.subtotal))}</td>
                    </tr>
                    {Number(est.taxAmount) > 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-2 text-right text-gray-500">
                          Tax ({String(est.taxRate)}%)
                        </td>
                        <td className="px-4 py-2 text-right">{formatCurrency(String(est.taxAmount))}</td>
                      </tr>
                    )}
                    <tr className="text-base font-semibold">
                      <td colSpan={4} className="px-6 py-3 text-right">Total</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(String(est.total))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </section>
        )}

        {/* Change Orders */}
        {project.changeOrders.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">Change Orders</h2>
            {project.changeOrders.map((co) => (
              <div key={co.id} className="mb-4 rounded-lg border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="font-semibold">
                      Change Order #{co.number}: {co.title}
                    </h3>
                    <p className="text-sm text-gray-500">{co.description}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${statusColors[co.status] || ""}`}>
                      {co.status}
                    </span>
                    <p className={`mt-1 text-sm font-semibold ${Number(co.costImpact) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {Number(co.costImpact) >= 0 ? "+" : ""}
                      {formatCurrency(String(co.costImpact))}
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  {co.lineItems.map((item) => (
                    <div key={item.id} className="mb-2 flex items-center gap-3 text-sm">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          item.action === "add"
                            ? "bg-green-100 text-green-700"
                            : item.action === "remove"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {item.action}
                      </span>
                      <span>{item.description}</span>
                      <span className="ml-auto font-medium">{formatCurrency(String(item.total))}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Invoices */}
        {project.invoices.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">Invoices</h2>
            {project.invoices.map((inv) => (
              <div key={inv.id} className="mb-4 rounded-lg border bg-white shadow-sm">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="font-semibold">Invoice #{inv.number}</h3>
                    <p className="text-sm text-gray-500">
                      {formatDate(inv.createdAt)}
                      {inv.dueDate && ` — Due: ${formatDate(inv.dueDate)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${statusColors[inv.status] || ""}`}>
                      {inv.status}
                    </span>
                    <p className="mt-1 text-lg font-bold">{formatCurrency(String(inv.total))}</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-6 py-2 font-medium">Description</th>
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Materials</th>
                      <th className="px-4 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.lineItems.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-6 py-2">{item.description}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {item.timeHours && item.timeRate ? (
                            <span>{String(item.timeHours)} hrs @ {formatCurrency(String(item.timeRate))}/hr</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {item.materialsCost ? (
                            formatCurrency(String(item.materialsCost))
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(String(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-base font-semibold">
                      <td colSpan={3} className="px-6 py-3 text-right">Total</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(String(inv.total))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </section>
        )}
      </main>

      <footer className="border-t py-6 text-center text-sm text-gray-500">
        Powered by ConstructAI
      </footer>
    </div>
  );
}
