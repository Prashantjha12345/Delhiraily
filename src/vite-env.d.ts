/// <reference types="vite/client" />

declare global {
  interface Window {
    google?: {
      maps: {
        Geocoder: new () => {
          geocode(
            request: { location: { lat: number; lng: number } },
            callback: (
              results: Array<{
                formatted_address?: string;
                address_components: Array<{ long_name: string; types: string[] }>;
              }> | null,
              status: string
            ) => void
          ): void;
        };
      };
    };
  }
}

export {};
