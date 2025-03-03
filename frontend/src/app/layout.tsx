"use client";

import { CacheProvider } from "@chakra-ui/next-js";
import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "react-query";

// Create a client
const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Superconnector Email</title>
        <meta
          name="description"
          content="A secure email analysis application"
        />
      </head>
      <body>
        <CacheProvider>
          <ChakraProvider>
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          </ChakraProvider>
        </CacheProvider>
      </body>
    </html>
  );
}
