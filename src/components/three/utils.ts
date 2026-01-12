export function altAzToCartesian(alt: number, az: number, radius: number): { x: number; y: number; z: number } {
    const altRad = (alt * Math.PI) / 180;
    const azRad = (az * Math.PI) / 180;

    const x_enu = radius * Math.cos(altRad) * Math.sin(azRad);
    const y_enu = radius * Math.sin(altRad);
    const z_enu = radius * Math.cos(altRad) * Math.cos(azRad);

    const x = x_enu;
    const y = y_enu;
    const z = -z_enu;
    return { x, y, z };
}
