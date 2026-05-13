/** True when running inside a Windows Subsystem for Linux environment. */
export const IS_WSL = !!(process.env['WSL_DISTRO_NAME'] ?? process.env['WSL_INTEROP']);
