import { Redirect, useLocalSearchParams } from 'expo-router';

/** Kept for old links: a product's own page is now its edit form. */
export default function EditProductRedirect() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  return (
    <Redirect
      href={{ pathname: '/product/[id]', params: { id, ...(section ? { section } : {}) } }}
    />
  );
}
