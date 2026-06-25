/** Form-factor bucket logic mirrors useFormFactor (width-based per plan §6.7). */
function bucketFromWidth(width: number): 'compact' | 'medium' | 'expanded' {
  if (width >= 840) return 'expanded';
  if (width >= 600) return 'medium';
  return 'compact';
}

describe('form factor buckets', () => {
  it('classifies compact phones by width', () => {
    expect(bucketFromWidth(320)).toBe('compact');
    expect(bucketFromWidth(599)).toBe('compact');
  });

  it('classifies medium phablets / landscape phones', () => {
    expect(bucketFromWidth(600)).toBe('medium');
    expect(bucketFromWidth(839)).toBe('medium');
  });

  it('classifies expanded tablets by width even in portrait', () => {
    expect(bucketFromWidth(840)).toBe('expanded');
    expect(bucketFromWidth(600)).not.toBe('expanded');
  });
});
