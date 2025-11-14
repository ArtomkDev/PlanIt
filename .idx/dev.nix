# To learn more about how to use Nix to configure your environment
# see: https://firebase.google.com/docs/studio/customize-workspace
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Use https://search.nixos.org/packages to find packages
  packages = [
    # pkgs.go
    # pkgs.python311
    # pkgs.python311Packages.pip
    pkgs.nodejs_20
    # pkgs.nodePackages.nodemon
  ];

  # Sets environment variables in the workspace
  env = {};
  idx = {
    # Search for extensions in the VS Code Marketplace and use "publisher.name"
    extensions = [
      # "vscodevim.vim"
    ];

    workspace = {
      # Runs when the workspace is first created
      onCreate = {
        # Welcome message
        # welcome = ''
        #   # Welcome to your new workspace!
        #
        #   Your project is ready to go. You can now:
        #   * Run `npm install` to install dependencies
        #   * Run `npm start` to start the development server
        #   * Connect to the apps in this workspace to see your changes
        # '';
      };
      # Runs when the workspace is started
      onStart = {
        # Example that starts a background task
        # web-server = "npm start";
      };
    };

    # The following ports are forwarded from your workspace
    # to your local machine.
    ports."4000" = "http";
    ports."3000" = "http";
    ports."8081" = "http";
    ports."19000" = "http";
    ports."8082" = "http";
  };
}
