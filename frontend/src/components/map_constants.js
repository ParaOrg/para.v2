// Marker colors matching backend types.ts
export const MARKER_COLORS = {
    User_Location: "#4285F4",
    End_Destination: "#EA4335",
    Jeepney: "#FBBC05",
    Bus: "#34A853",
    UV: "#9C27B0",
    Train: "#FF6D00",
    Walk: "#757575",
    Default: "#666666"
};

// Destination pin SVG as data URL (location pin with teardrop + inner circle)
function getDestinationPinSvgUrl(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="31" height="38" viewBox="0 0 31 38" fill="none">
  <path d="M15.5 0.5C23.7843 0.5 30.5 7.76526 30.5 16.7266C30.4998 27.1266 21.7243 33.8221 17.5977 36.3955C16.3 37.2047 14.7 37.2047 13.4023 36.3955C9.27574 33.8221 0.500248 27.1266 0.5 16.7266C0.5 7.76531 7.21572 0.500074 15.5 0.5ZM15.499 9.77246C11.9486 9.77246 9.07031 12.886 9.07031 16.7266C9.07047 20.567 11.9487 23.6807 15.499 23.6807C19.0493 23.6806 21.9276 20.5669 21.9277 16.7266C21.9277 12.886 19.0494 9.77251 15.499 9.77246Z" fill="${color}"/>
  <path d="M15.5 0.5V0H15.5L15.5 0.5ZM30.5 16.7266L31 16.7266V16.7266H30.5ZM17.5977 36.3955L17.8622 36.8198L17.8622 36.8198L17.5977 36.3955ZM13.4023 36.3955L13.1378 36.8198H13.1378L13.4023 36.3955ZM0.5 16.7266H0V16.7266L0.5 16.7266ZM15.499 9.77246L15.499 9.27246H15.499V9.77246ZM9.07031 16.7266H8.57031V16.7266L9.07031 16.7266ZM15.499 23.6807V24.1807H15.499L15.499 23.6807ZM21.9277 16.7266L22.4277 16.7266V16.7266H21.9277ZM15.5 0.5V1C23.4719 1 30 8.00366 30 16.7266H30.5H31C31 7.52686 24.0968 0 15.5 0V0.5ZM30.5 16.7266L30 16.7266C29.9999 21.7775 27.8705 25.9428 25.21 29.1785C22.5474 32.4168 19.3709 34.7004 17.3331 35.9712L17.5977 36.3955L17.8622 36.8198C19.951 35.5171 23.2256 33.1664 25.9824 29.8136C28.7414 26.4581 30.9999 22.0757 31 16.7266L30.5 16.7266ZM17.5977 36.3955L17.3331 35.9712C16.1973 36.6794 14.8026 36.6795 13.6669 35.9712L13.4023 36.3955L13.1378 36.8198C14.5974 37.73 16.4026 37.7299 17.8622 36.8198L17.5977 36.3955ZM13.4023 36.3955L13.6669 35.9712C11.6291 34.7004 8.45265 32.4168 5.79 29.1785C3.12952 25.9428 1.00012 21.7775 1 16.7266L0.5 16.7266L0 16.7266C0.000127465 22.0757 2.2586 26.4581 5.01758 29.8136C7.77439 33.1664 11.049 35.5171 13.1378 36.8198L13.4023 36.3955ZM0.5 16.7266H1C1 8.00371 7.52814 1.00007 15.5 1L15.5 0.5L15.5 0C6.90329 7.64728e-05 0 7.5269 0 16.7266H0.5ZM15.499 9.77246V9.27246C11.6362 9.27246 8.57031 12.6476 8.57031 16.7266H9.07031H9.57031C9.57031 13.1244 12.261 10.2725 15.499 10.2725V9.77246ZM9.07031 16.7266L8.57031 16.7266C8.57048 20.8054 11.6363 24.1807 15.499 24.1807V23.6807V23.1807C12.2611 23.1807 9.57046 20.3286 9.57031 16.7265L9.07031 16.7266ZM15.499 23.6807L15.499 24.1807C19.3617 24.1806 22.4276 20.8054 22.4277 16.7266L21.9277 16.7266L21.4277 16.7265C21.4276 20.3285 18.7369 23.1806 15.499 23.1807L15.499 23.6807ZM21.9277 16.7266H22.4277C22.4277 12.6476 19.3618 9.27252 15.499 9.27246L15.499 9.77246L15.499 10.2725C18.737 10.2725 21.4277 13.1245 21.4277 16.7266H21.9277Z" fill="#331C21"/>
</svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getUserLocationPinSvgUrl(color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="45" viewBox="0 0 45 45" fill="none">
  <g filter="url(#filter0_d_3306_2907)">
    <path d="M8 20.5C8 13.5964 13.5964 8 20.5 8C27.4036 8 33 13.5964 33 20.5C33 27.4036 27.4036 33 20.5 33C13.5964 33 8 27.4036 8 20.5Z" fill="#3C029A"/>
  </g>
  <path d="M20.7417 42.6834L15.0198 35.4082L26.6951 35.5965L20.7417 42.6834Z" fill="#3C029A"/>
  <circle cx="20.5" cy="20.5" r="6.5" fill="#FCFCF5"/>
  <defs>
    <filter id="filter0_d_3306_2907" x="0" y="0" width="45" height="45" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dx="2" dy="2"/>
      <feGaussianBlur stdDeviation="5"/>
      <feComposite in2="hardAlpha" operator="out"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0"/>
      <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_3306_2907"/>
      <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_3306_2907" result="shape"/>
    </filter>
  </defs>
</svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}


// Line colors for polylines
export const LINE_COLORS = {
    Jeepney: "#FBBC05",
    Bus: "#34A853",
    UV: "#9C27B0",
    Train: "#FF6D00",
    Walk: "#757575",
    Transit: "#34A853",
    Default: "#4285F4"
};

// Custom marker icons using Google Maps symbols
export const getMarkerIcon = (google, type) => {
    const color = MARKER_COLORS[type] || MARKER_COLORS.Default;
    
    // Special icons for specific types
    switch (type) {
        case "User_Location":
            return {
                url: getUserLocationPinSvgUrl(color),
                scaledSize: new google.maps.Size(45, 45),
                // Anchor at the tip of the pin (triangle tip is ~20.74, 42.68 in the SVG)
                anchor: new google.maps.Point(20.74, 42.68)
            };
        case "End_Destination":
            return {
                url: getDestinationPinSvgUrl(color),
                scaledSize: new google.maps.Size(31, 38),
                anchor: new google.maps.Point(15.5, 38)
            };
        case "Train":
            return {
                path: "M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7z",
                scale: 1.5,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 1,
                anchor: new google.maps.Point(12, 22)
            };
        case "Jeepney":
            return {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 5,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: "#333",
                strokeWeight: 1,
                rotation: 90
            };
        case "Bus":
            return {
                path: "M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z",
                scale: 1.2,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 1,
                anchor: new google.maps.Point(12, 12)
            };
        case "UV":
            return {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2,
            };
        case "Walk":
            return {
                path: "M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7",
                scale: 1.3,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 0.5,
                anchor: new google.maps.Point(12, 12)
            };
        default:
            return {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2,
            };
    }
};

// Get line color for a transport type
export const getLineColor = (type) => {
    return LINE_COLORS[type] || LINE_COLORS.Default;
};

// Get line style options
export const getLineOptions = (type) => {
    const color = getLineColor(type);
    
    const baseOptions = {
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 5,
    };
    
    // Dashed line for walking
    if (type === "Walk") {
        return {
            ...baseOptions,
            strokeOpacity: 0,
            icons: [{
                icon: {
                    path: "M 0,-1 0,1",
                    strokeOpacity: 1,
                    strokeColor: color,
                    scale: 3
                },
                offset: "0",
                repeat: "15px"
            }]
        };
    }
    
    return baseOptions;
};
