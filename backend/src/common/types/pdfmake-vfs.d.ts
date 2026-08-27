declare module 'pdfmake/build/vfs_fonts.js' {
  /** Map nom de fichier de police → données base64 (ex. Roboto-Regular.ttf). */
  const fonts: Record<string, string>;
  export default fonts;
}
