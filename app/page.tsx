import { ProductList } from "@/components/ProductList";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Computer Parts</h1>
        <p className="text-muted-foreground mt-1">
          Browse GPUs, CPUs, displays, and more — available across all warehouses
        </p>
      </div>
      <ProductList />
    </div>
  );
}
