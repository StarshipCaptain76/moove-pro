import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

type Picked = { name?: string; phone?: string; email?: string };

interface Props {
  onPick: (c: Picked) => void;
}

export function ContactImportButton({ onPick }: Props) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        "contacts" in navigator &&
        "ContactsManager" in window,
    );
  }, []);

  if (!supported) return null;

  const onClick = async () => {
    try {
      const results: Array<{ name?: string[]; tel?: string[]; email?: string[] }> =
        await (navigator as unknown as {
          contacts: {
            select: (
              props: string[],
              opts: { multiple: boolean },
            ) => Promise<Array<{ name?: string[]; tel?: string[]; email?: string[] }>>;
          };
        }).contacts.select(["name", "tel", "email"], { multiple: false });

      if (!results || results.length === 0) return;
      const c = results[0];
      const picked: Picked = {};
      const name = c.name?.find((v) => v && v.trim());
      const tel = c.tel?.find((v) => v && v.trim());
      const email = c.email?.find((v) => v && v.trim());
      if (name) picked.name = name.trim();
      if (tel) picked.phone = tel.trim();
      if (email) picked.email = email.trim();
      if (!picked.name && !picked.phone && !picked.email) {
        toast.error("Contact had no usable details");
        return;
      }
      onPick(picked);
    } catch (e) {
      console.error(e);
      toast.error("Could not open contacts");
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick}>
      <UserPlus className="h-4 w-4 mr-1" /> Contacts
    </Button>
  );
}