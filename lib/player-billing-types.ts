export const billingFields = ["full_name", "dni", "address", "postal_code", "city", "province"] as const;
export type PlayerBilling = Record<typeof billingFields[number], string>;
export const emptyBilling = (): PlayerBilling => ({ full_name: "", dni: "", address: "", postal_code: "", city: "", province: "" });
