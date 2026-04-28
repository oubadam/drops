import normaldrop from "@/components/normaldrop.png";

export default function Head() {
  return (
    <>
      <title>drops</title>
      <link rel="icon" href={normaldrop.src} type="image/png" />
      <link rel="shortcut icon" href={normaldrop.src} type="image/png" />
      <link rel="apple-touch-icon" href={normaldrop.src} />
    </>
  );
}
