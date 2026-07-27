type AppLocation = {
  hash: string;
  pathname: string;
  search: string;
};

export function redirectAppToSignIn(
  location: AppLocation = window.location,
  replace: (destination: string) => void = (destination) =>
    window.location.replace(destination),
) {
  const redirect = `${location.pathname}${location.search}${location.hash}`;
  const search = new URLSearchParams({ redirect });

  replace(`/sign-in?${search.toString()}`);
}
