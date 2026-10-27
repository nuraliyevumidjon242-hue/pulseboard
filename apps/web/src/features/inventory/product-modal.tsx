import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api, getErrorMessage } from '../../lib/api';
import { firstFieldErrors } from '../../lib/forms';
import { useCategories } from '../../hooks/api';
import { useStoreContext } from '../../hooks/use-store-context';
import { toast } from '../../stores/toast-store';
import type { Product } from '../../types';
import { Button } from '../../components/ui/button';
import { Field, Input, Select, Textarea } from '../../components/ui/form';
import { FormAlert } from '../../components/auth/auth-layout';
import { Modal } from '../../components/ui/modal';

const schema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(255),
  sku: z.string().trim().min(1, 'SKU is required').max(100),
  category: z.string().trim().max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0, 'Price cannot be negative').max(1_000_000_000),
  cost: z.string().optional(),
  currentStock: z.coerce.number().int().min(0).max(10_000_000),
  minStock: z.coerce.number().int().min(0).max(10_000_000),
  maxStock: z.coerce.number().int().min(0).max(10_000_000),
  unit: z.string().min(1).max(20),
  barcode: z.string().trim().max(100).optional(),
  expiryDate: z.string().optional(),
});

type ProductForm = z.infer<typeof schema>;

const UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'pack', 'box', 'bottle'];

export function ProductModal({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
}) {
  const { storeId, currency } = useStoreContext();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories(storeId);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const isEdit = Boolean(product);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      sku: '',
      category: '',
      description: '',
      price: 0,
      cost: '',
      currentStock: 0,
      minStock: 10,
      maxStock: 1000,
      unit: 'pcs',
      barcode: '',
      expiryDate: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setFieldErrors({});
    if (product) {
      reset({
        name: product.name,
        sku: product.sku,
        category: product.category ?? '',
        description: product.description ?? '',
        price: Number(product.price),
        cost: product.cost ?? '',
        currentStock: product.currentStock,
        minStock: product.minStock,
        maxStock: product.maxStock,
        unit: product.unit,
        barcode: product.barcode ?? '',
        expiryDate: product.expiryDate ?? '',
      });
    } else {
      reset({
        name: '',
        sku: '',
        category: '',
        description: '',
        price: 0,
        cost: '',
        currentStock: 0,
        minStock: 10,
        maxStock: 1000,
        unit: 'pcs',
        barcode: '',
        expiryDate: '',
      });
    }
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ProductForm) => {
      const payload = {
        name: values.name,
        sku: values.sku,
        category: values.category || undefined,
        description: values.description || undefined,
        price: values.price,
        ...(values.cost !== '' && values.cost !== undefined ? { cost: Number(values.cost) } : {}),
        ...(isEdit ? {} : { currentStock: values.currentStock }),
        minStock: values.minStock,
        maxStock: values.maxStock,
        unit: values.unit,
        barcode: values.barcode || undefined,
        expiryDate: values.expiryDate || undefined,
      };
      if (isEdit && product) {
        const response = await api.patch<{ data: { product: Product } }>(
          `/stores/${storeId}/products/${product.id}`,
          payload,
        );
        return response.data.data.product;
      }
      const response = await api.post<{ data: { product: Product } }>(
        `/stores/${storeId}/products`,
        payload,
      );
      return response.data.data.product;
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Product updated' : 'Product added', saved.name);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (error) => {
      setServerError(getErrorMessage(error));
      setFieldErrors(firstFieldErrors(error));
    },
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    setFieldErrors({});
    mutation.mutate(values);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit product' : 'Add product'}
      description={
        isEdit ? `Update ${product?.name}` : 'Add a new item to your catalogue and stock.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError ? <FormAlert>{serverError}</FormAlert> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Product name"
            htmlFor="product-name"
            error={errors.name?.message ?? fieldErrors.name}
          >
            <Input
              id="product-name"
              placeholder="Oat milk 1L"
              invalid={Boolean(errors.name)}
              {...register('name')}
            />
          </Field>
          <Field label="SKU" htmlFor="product-sku" error={errors.sku?.message ?? fieldErrors.sku}>
            <Input
              id="product-sku"
              placeholder="MLK-120"
              invalid={Boolean(errors.sku)}
              {...register('sku')}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Category"
            htmlFor="product-category"
            hint="Reuse an existing category or create a new one"
          >
            <Input
              id="product-category"
              list="product-category-options"
              placeholder="Dairy"
              {...register('category')}
            />
            <datalist id="product-category-options">
              {(categories ?? []).map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
          <Field label="Unit" htmlFor="product-unit" error={errors.unit?.message}>
            <Select id="product-unit" {...register('unit')}>
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={`Selling price (${currency})`}
            htmlFor="product-price"
            error={errors.price?.message ?? fieldErrors.price}
          >
            <Input
              id="product-price"
              type="number"
              step="0.01"
              min="0"
              invalid={Boolean(errors.price)}
              {...register('price')}
            />
          </Field>
          <Field
            label={`Cost price (${currency})`}
            htmlFor="product-cost"
            hint="Optional — enables profit reporting"
          >
            <Input
              id="product-cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...register('cost')}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Stock on hand"
            htmlFor="product-stock"
            error={errors.currentStock?.message}
            hint={isEdit ? 'Use Adjust stock for audited changes' : undefined}
          >
            <Input
              id="product-stock"
              type="number"
              min="0"
              step="1"
              disabled={isEdit}
              {...register('currentStock')}
            />
          </Field>
          <Field label="Min stock" htmlFor="product-min" error={errors.minStock?.message}>
            <Input id="product-min" type="number" min="0" step="1" {...register('minStock')} />
          </Field>
          <Field label="Max stock" htmlFor="product-max" error={errors.maxStock?.message}>
            <Input id="product-max" type="number" min="0" step="1" {...register('maxStock')} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Barcode" htmlFor="product-barcode" hint="Scan or paste the EAN/UPC">
            <Input id="product-barcode" placeholder="4001234567890" {...register('barcode')} />
          </Field>
          <Field label="Expiry date" htmlFor="product-expiry" hint="Optional, for perishable goods">
            <Input id="product-expiry" type="date" {...register('expiryDate')} />
          </Field>
        </div>

        <Field
          label="Description"
          htmlFor="product-description"
          error={errors.description?.message}
        >
          <Textarea
            id="product-description"
            rows={2}
            placeholder="Optional notes shown to your team"
            {...register('description')}
          />
        </Field>
      </form>
    </Modal>
  );
}
