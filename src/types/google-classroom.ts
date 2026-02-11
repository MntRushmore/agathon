export interface GCCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  courseState?: string;
  alternateLink?: string;
  /** Set if already imported as an Agathon class */
  importedClassId?: string | null;
}
