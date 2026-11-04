import styles from "./auth.module.css";

interface OrganizationOptionProps {
  slug: string;
  name: string;
  isChecked: boolean;
  onChoose: (slug: string) => void;
}

/** One organization as a native radio button: arrow keys, Space and screen readers just work. */
export function OrganizationOption({ slug, name, isChecked, onChoose }: OrganizationOptionProps) {
  return (
    <label className={styles.option}>
      <input
        type="radio"
        name="organization"
        value={slug}
        checked={isChecked}
        onChange={() => {
          onChoose(slug);
        }}
      />
      <span>{name}</span>
    </label>
  );
}
