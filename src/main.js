/* CamelAML — application entry */
import "@fontsource-variable/inter";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/views.css";
import "virtual:camelaml-app";
import { registerSW } from "virtual:pwa-register";

/* installable, works offline, updates itself quietly in the background */
if ("serviceWorker" in navigator && location.protocol !== "file:") registerSW({ immediate: true });
