export class TranscrEditorConfig {
  public settings: any = {
    markers: [],
    // disabled shortcuts
    disabled_keys: ['ENTER', 'SHIFT + ENTER', 'TAB'],
    height: 300,
    responsive: false,
    btnPopover: true,
    special_markers: {
      boundary: false
    }
  };
}
