import { Button, Input } from "@remora/ui";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

export type AccountImpersonationUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type AccountImpersonationSearchField = "email" | "name";

export type AccountImpersonationAdapter = {
  listUsers: (input: {
    searchField: AccountImpersonationSearchField;
    searchValue: string;
    limit: number;
    offset: number;
  }) => Promise<{
    users: AccountImpersonationUser[];
    total: number;
  }>;
  impersonateUser: (userId: string) => Promise<void>;
};

const pageSize = 25;
const searchDebounceMs = 300;

export function AccountImpersonationPage({
  adapter,
  onImpersonated,
}: {
  adapter: AccountImpersonationAdapter;
  onImpersonated: () => void;
}) {
  const [searchField, setSearchField] =
    useState<AccountImpersonationSearchField>("email");
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<AccountImpersonationUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = globalThis.setTimeout(() => {
      setOffset(0);
      setSearchValue(searchInput.trim());
    }, searchDebounceMs);

    return () => globalThis.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    void adapter
      .listUsers({
        searchField,
        searchValue,
        limit: pageSize,
        offset,
      })
      .then((result) => {
        if (cancelled) return;

        setUsers(result.users);
        setTotal(result.total);
      })
      .catch(() => {
        if (cancelled) return;

        setUsers([]);
        setTotal(0);
        setError("Unable to load accounts.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adapter, offset, searchField, searchValue]);

  async function impersonateUser(userId: string) {
    setPendingUserId(userId);
    setError(null);

    try {
      await adapter.impersonateUser(userId);
      onImpersonated();
    } catch {
      setError("Unable to impersonate this account.");
    } finally {
      setPendingUserId(null);
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + pageSize, total);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium">Account impersonation</h1>
        <p className="text-muted-foreground text-sm">
          Open Remora using a customer&apos;s real account and permissions.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="account-search-field">
          Search field
        </label>
        <select
          id="account-search-field"
          className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-md border px-2.5 text-sm outline-none focus-visible:ring-3"
          value={searchField}
          onChange={(event) => {
            setOffset(0);
            setSearchField(
              event.target.value as AccountImpersonationSearchField,
            );
          }}
        >
          <option value="email">Email</option>
          <option value="name">Name</option>
        </select>
        <div className="relative max-w-md flex-1">
          <SearchIcon
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          />
          <Input
            aria-label={`Search users by ${searchField}`}
            className="pl-8"
            placeholder={`Search by ${searchField}`}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="border-border overflow-hidden rounded-lg border">
        <div className="bg-muted/30 text-muted-foreground grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_10rem_8rem] gap-4 border-b px-4 py-2 text-xs font-medium">
          <span>Name</span>
          <span>Email</span>
          <span>Joined</span>
          <span className="sr-only">Actions</span>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            Loading accounts...
          </p>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            No accounts found.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {users.map((user) => (
              <li
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_10rem_8rem] items-center gap-4 px-4 py-3"
                key={user.id}
              >
                <span className="truncate text-sm">{user.name}</span>
                <span className="text-muted-foreground truncate text-sm">
                  {user.email}
                </span>
                <span className="text-muted-foreground text-sm">
                  {formatDate(user.createdAt)}
                </span>
                <Button
                  disabled={pendingUserId !== null}
                  size="sm"
                  type="button"
                  onClick={() => void impersonateUser(user.id)}
                >
                  {pendingUserId === user.id ? "Opening..." : "Impersonate"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          {pageStart}-{pageEnd} of {total}
        </p>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Previous accounts"
            disabled={offset === 0 || isLoading}
            size="icon-sm"
            type="button"
            variant="outline"
            onClick={() => setOffset(Math.max(0, offset - pageSize))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            aria-label="Next accounts"
            disabled={offset + pageSize >= total || isLoading}
            size="icon-sm"
            type="button"
            variant="outline"
            onClick={() => setOffset(offset + pageSize)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}
