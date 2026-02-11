import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// If your Prisma file is located elsewhere, you can change the path
import { Polar } from "@polar-sh/sdk";
import { env } from "~/env";
import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { db } from "~/server/db";

const polarClient = new Polar({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  accessToken: env.POLAR_ACCESS_TOKEN,
  server: "sandbox",
});

const prisma = new PrismaClient();
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // or "mysql", "postgresql", ...etc
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            {
              productId: "44e37301-28ba-46c4-be5e-b73ec1431061",
              slug: "small",
            },
            {
              productId: "24f26ad2-6dd1-4c4a-b7d9-4c6f0c46f2e9",
              slug: "medium",
            },
            {
              productId: "9ac72409-106e-4629-aa0d-c67a91e9e134",
              slug: "large",
            },
          ],
          successUrl: "/dashboard",
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          secret: env.POLAR_WEBHOOK_SECRET,
          onOrderPaid: async (order) => {
            const externalCustomerId = order.data.customer.externalId;

            if (!externalCustomerId) {
              console.error("No external customer ID found.");
              throw new Error("No external customer id found.");
            }

            const productId = order.data.productId;

            let creditsToAdd = 0;

            switch (productId) {
              case "44e37301-28ba-46c4-be5e-b73ec1431061":
                creditsToAdd = 50; 
                break;
              case "24f26ad2-6dd1-4c4a-b7d9-4c6f0c46f2e9":
                creditsToAdd = 200;
                break;
              case "9ac72409-106e-4629-aa0d-c67a91e9e134":
                creditsToAdd = 400;
                break;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            await db.user.update({
              where: { id: externalCustomerId },
              data: {
                credits: {
                  increment: creditsToAdd,
                },
              },
            });
          },
        }),
      ],
    }),
  ],
});