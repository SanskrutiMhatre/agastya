<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     JSS to XSL-FO: Chapters and sections

     A chapter opens with a divider page ("Chapter N / Title" plus the topic
     list) and is numbered chapter-relative (1-1, 1-2, ...).

     Page orientation can change at any section boundary, so a chapter is not
     necessarily one page-sequence: its sections are emitted as a flat run and
     split wherever the orientation changes. The first sequence of a chapter
     starts the folio at 1 and the rest continue it, keeping 1-1, 1-2, 1-3 ...
     unbroken across the splits.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <xsl:template match="chapter">
        <!-- Divider page; belongs to the chapter's first page-sequence -->
        <xsl:variable name="divider">
            <fo:block id="{concat('chapter-', @number)}">
                <fo:block font-size="{$heading1-size}" font-weight="bold" space-after="1mm">
                    <xsl:text>Chapter </xsl:text><xsl:value-of select="@number"/>
                </fo:block>
                <fo:block font-size="{$heading1-size}" font-weight="bold"
                          border-bottom="1pt solid black" padding-bottom="2mm" space-after="6mm">
                    <xsl:value-of select="title"/>
                </fo:block>
                <xsl:if test="section">
                    <fo:block space-after="3mm">This chapter covers the following topics:</fo:block>
                    <!-- break-after forces the chapter's actual content (first
                         section, or any content sitting directly on the
                         chapter) onto its own page, separate from this
                         overview table. -->
                    <fo:table table-layout="fixed" width="100%" break-after="page"
                              border-top="1pt solid black" border-bottom="1pt solid black">
                        <fo:table-column column-width="28mm"/>
                        <fo:table-column column-width="proportional-column-width(1)"/>
                        <fo:table-body>
                            <xsl:for-each select="section[not(@split)]">
                                <fo:table-row>
                                    <fo:table-cell padding="1.5mm" border-bottom="0.5pt solid black">
                                        <fo:block font-weight="bold">
                                            <xsl:call-template name="section-number"/>
                                        </fo:block>
                                    </fo:table-cell>
                                    <fo:table-cell padding="1.5mm" border-bottom="0.5pt solid black">
                                        <fo:block font-weight="bold"><xsl:value-of select="title"/></fo:block>
                                    </fo:table-cell>
                                </fo:table-row>
                                <!--
                                  padding-left goes on BOTH cells here, not
                                  just the number's: shifting only the number
                                  right while the title stayed anchored to the
                                  shared column boundary widened the gap
                                  between them for sub-items only. Indenting
                                  both by the same amount moves the whole row
                                  right as a unit — the sub-item visibly nests
                                  under its parent, and the number-to-title gap
                                  stays identical to every other row.
                                -->
                                <xsl:for-each select="section">
                                    <fo:table-row>
                                        <fo:table-cell padding="1.5mm" padding-left="8mm"
                                                       border-bottom="0.5pt solid black">
                                            <fo:block><xsl:call-template name="section-number"/></fo:block>
                                        </fo:table-cell>
                                        <fo:table-cell padding="1.5mm" padding-left="8mm"
                                                       border-bottom="0.5pt solid black">
                                            <fo:block><xsl:value-of select="title"/></fo:block>
                                        </fo:table-cell>
                                    </fo:table-row>
                                </xsl:for-each>
                            </xsl:for-each>
                        </fo:table-body>
                    </fo:table>
                </xsl:if>
            </fo:block>
            <!-- Content sitting directly on the chapter, ahead of any section -->
            <xsl:apply-templates select="para | list | table | figure | note | warning | caution"/>
        </xsl:variable>

        <xsl:variable name="end-marker">
            <fo:block text-align="center" space-before="8mm" font-size="{$table-font-size}">
                <xsl:text>--------- End of Chapter ---------</xsl:text>
            </fo:block>
        </xsl:variable>

        <xsl:choose>
            <xsl:when test="section">
                <!--
                  The divider is its own page-sequence, always portrait,
                  emitted before any section is looked at.

                  It used to be prepended into whichever page-sequence the
                  chapter's FIRST section-run turned out to be — which, for
                  an ordinary all-portrait chapter, is portrait and nobody
                  notices the coupling exists. The moment a chapter's first
                  section is itself marked landscape (a `<pmEntry
                  id="a3-landscape">` wrapping the chapter's opening
                  sub-section, say), the divider table — "Chapter 2", the
                  topics list for the WHOLE chapter, most of them ordinary
                  portrait sections — was dragged onto that landscape page
                  with it, sized for content it has nothing to do with.

                  first="1" here (not on the section runs below, which now
                  all start at first="0") is what keeps the chapter-relative
                  folio starting at 1 on the divider page exactly as before —
                  only WHICH page-sequence claims that first page number has
                  changed, not the numbering itself.
                -->
                <xsl:call-template name="body-page-sequence">
                    <xsl:with-param name="content" select="$divider"/>
                    <xsl:with-param name="chapter-number" select="@number"/>
                    <xsl:with-param name="first">1</xsl:with-param>
                    <xsl:with-param name="last">0</xsl:with-param>
                </xsl:call-template>
                <xsl:call-template name="emit-orientation-runs">
                    <xsl:with-param name="sections" select=".//section"/>
                    <xsl:with-param name="chapter-number" select="@number"/>
                    <xsl:with-param name="end-marker" select="$end-marker"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise>
                <xsl:call-template name="body-page-sequence">
                    <xsl:with-param name="content">
                        <xsl:copy-of select="$divider"/>
                        <xsl:copy-of select="$end-marker"/>
                    </xsl:with-param>
                    <xsl:with-param name="chapter-number" select="@number"/>
                    <xsl:with-param name="orientation" select="@orientation"/>
                    <xsl:with-param name="first">1</xsl:with-param>
                </xsl:call-template>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!--
      Emit one page-sequence per run of consecutive sections sharing an
      orientation.

      Always first="0": the chapter's divider page, above, is what claims the
      folio-restarting first page-sequence now, so every section run — this
      chapter's first one included — continues the folio rather than
      restarting it. Splitting a chapter's sections across two or more
      orientations therefore never resets the numbering back to "2-1" partway
      through; only the divider page ever does that.
    -->
    <xsl:template name="emit-orientation-runs">
        <xsl:param name="sections"/>
        <xsl:param name="chapter-number"/>
        <xsl:param name="end-marker"/>

        <xsl:if test="count($sections) &gt; 0">
            <xsl:variable name="orientation">
                <xsl:for-each select="$sections[1]">
                    <xsl:call-template name="effective-orientation"/>
                </xsl:for-each>
            </xsl:variable>

            <xsl:variable name="run">
                <xsl:call-template name="orientation-run-length">
                    <xsl:with-param name="sections" select="$sections"/>
                    <xsl:with-param name="orientation" select="$orientation"/>
                </xsl:call-template>
            </xsl:variable>
            <xsl:variable name="n" select="number($run)"/>

            <!--
              A landscape run is a physically distinct print unit: bound
              rotated, read by turning the book. If it does not consume an
              even number of sheets, its own "back" page ends up carrying the
              NEXT run's portrait content printed sideways, and everything
              after it runs one page out of step with the rest of the book's
              recto/verso rhythm — a later chapter meant to open on the right
              could land on the left instead.

              Unlike an ordinary mid-chapter orientation split (deliberately
              left unpadded — see body-page-sequence's own note on that),
              padding here is not spurious: it applies at BOTH edges of a
              landscape run, so the excursion is transparent to everything
              else's page parity. this run's own close (orientation itself
              is landscape) covers the "landscape run's own back page" case;
              the run immediately BEFORE a landscape one (next-orientation is
              landscape) covers "the page before it must end even, so the
              landscape run itself always opens on the right."
            -->
            <xsl:variable name="remaining" select="$sections[position() &gt; $n]"/>
            <xsl:variable name="next-orientation">
                <xsl:if test="$remaining">
                    <xsl:for-each select="$remaining[1]">
                        <xsl:call-template name="effective-orientation"/>
                    </xsl:for-each>
                </xsl:if>
            </xsl:variable>
            <xsl:variable name="landscape-boundary" select="
                $orientation = 'landscape' or $orientation = 'a3-landscape'
                or $next-orientation = 'landscape' or $next-orientation = 'a3-landscape'"/>

            <xsl:call-template name="body-page-sequence">
                <xsl:with-param name="content">
                    <xsl:apply-templates select="$sections[position() &lt;= $n]" mode="flat"/>
                    <xsl:if test="count($sections) = $n"><xsl:copy-of select="$end-marker"/></xsl:if>
                </xsl:with-param>
                <xsl:with-param name="chapter-number" select="$chapter-number"/>
                <xsl:with-param name="orientation" select="$orientation"/>
                <xsl:with-param name="first">0</xsl:with-param>
                <xsl:with-param name="last">
                    <xsl:choose>
                        <xsl:when test="count($sections) = $n">1</xsl:when>
                        <xsl:when test="$landscape-boundary">1</xsl:when>
                        <xsl:otherwise>0</xsl:otherwise>
                    </xsl:choose>
                </xsl:with-param>
            </xsl:call-template>

            <xsl:call-template name="emit-orientation-runs">
                <xsl:with-param name="sections" select="$sections[position() &gt; $n]"/>
                <xsl:with-param name="chapter-number" select="$chapter-number"/>
                <xsl:with-param name="end-marker" select="$end-marker"/>
            </xsl:call-template>
        </xsl:if>
    </xsl:template>

    <!-- How many leading sections share $orientation -->
    <xsl:template name="orientation-run-length">
        <xsl:param name="sections"/>
        <xsl:param name="orientation"/>
        <xsl:param name="i" select="1"/>
        <xsl:choose>
            <xsl:when test="$i &gt; count($sections)">
                <xsl:value-of select="$i - 1"/>
            </xsl:when>
            <xsl:otherwise>
                <xsl:variable name="this">
                    <xsl:for-each select="$sections[$i]">
                        <xsl:call-template name="effective-orientation"/>
                    </xsl:for-each>
                </xsl:variable>
                <xsl:choose>
                    <xsl:when test="$this = $orientation">
                        <xsl:call-template name="orientation-run-length">
                            <xsl:with-param name="sections" select="$sections"/>
                            <xsl:with-param name="orientation" select="$orientation"/>
                            <xsl:with-param name="i" select="$i + 1"/>
                        </xsl:call-template>
                    </xsl:when>
                    <xsl:otherwise><xsl:value-of select="$i - 1"/></xsl:otherwise>
                </xsl:choose>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!-- A section inherits orientation from the nearest marked ancestor,
         falling back to the chapter's own setting. -->
    <xsl:template name="effective-orientation">
        <xsl:variable name="marked" select="(ancestor-or-self::section[@orientation])[last()]"/>
        <xsl:choose>
            <xsl:when test="$marked"><xsl:value-of select="$marked/@orientation"/></xsl:when>
            <xsl:otherwise><xsl:value-of select="ancestor::chapter[1]/@orientation"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!--
      Section numbering follows the stencil: top-level sections are numbered
      "<chapter>.<n>", nested ones append a further level ("2.6.1.1").
    -->
    <xsl:template name="section-number">
        <!-- Sections marked @split exist only to carry a page orientation (see
             content.xsl). They are invisible to numbering: skipped in the
             ancestor chain, and not counted among preceding siblings, so
             rotating one block does not renumber everything after it. -->
        <xsl:for-each select="ancestor-or-self::section[not(@split)]">
            <xsl:if test="position() = 1">
                <xsl:value-of select="ancestor::chapter[1]/@number"/>
                <xsl:text>.</xsl:text>
            </xsl:if>
            <xsl:value-of select="count(preceding-sibling::section[not(@split)]) + 1"/>
            <xsl:if test="position() != last()">
                <xsl:text>.</xsl:text>
            </xsl:if>
        </xsl:for-each>
    </xsl:template>

    <!--
      Flat rendering: the heading plus this section's own content, but NOT its
      nested sections, which are emitted as their own units by the caller.
      Indentation therefore comes from the nesting depth rather than from
      physically nesting the blocks.
    -->
    <!--
      A split section has no title and no number; it is a page-orientation
      boundary and nothing more. Emit its content bare, so a rotated table
      looks exactly as it would have done inline.
    -->
    <xsl:template match="section[@split]" mode="flat">
        <xsl:apply-templates select="node()[not(self::section)]"/>
    </xsl:template>

    <xsl:template match="section" mode="flat">
        <xsl:variable name="depth" select="count(ancestor::section) + 1"/>
        <!-- Clamp to the four configured levels; deeper sections reuse level 4. -->
        <xsl:variable name="lvl">
            <xsl:choose>
                <xsl:when test="$depth &gt; 4">4</xsl:when>
                <xsl:otherwise><xsl:value-of select="$depth"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="hsize">
            <xsl:choose>
                <xsl:when test="$lvl = 1"><xsl:value-of select="$heading.1.size"/></xsl:when>
                <xsl:when test="$lvl = 2"><xsl:value-of select="$heading.2.size"/></xsl:when>
                <xsl:when test="$lvl = 3"><xsl:value-of select="$heading.3.size"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$heading.4.size"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="hsb">
            <xsl:choose>
                <xsl:when test="$lvl = 1"><xsl:value-of select="$heading.1.spaceBefore"/></xsl:when>
                <xsl:when test="$lvl = 2"><xsl:value-of select="$heading.2.spaceBefore"/></xsl:when>
                <xsl:when test="$lvl = 3"><xsl:value-of select="$heading.3.spaceBefore"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$heading.4.spaceBefore"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="hsa">
            <xsl:choose>
                <xsl:when test="$lvl = 1"><xsl:value-of select="$heading.1.spaceAfter"/></xsl:when>
                <xsl:when test="$lvl = 2"><xsl:value-of select="$heading.2.spaceAfter"/></xsl:when>
                <xsl:when test="$lvl = 3"><xsl:value-of select="$heading.3.spaceAfter"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$heading.4.spaceAfter"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="hindent">
            <xsl:choose>
                <xsl:when test="$lvl = 1"><xsl:value-of select="$heading.1.indent"/></xsl:when>
                <xsl:when test="$lvl = 2"><xsl:value-of select="$heading.2.indent"/></xsl:when>
                <xsl:when test="$lvl = 3"><xsl:value-of select="$heading.3.indent"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$heading.4.indent"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="hbody">
            <xsl:choose>
                <xsl:when test="$lvl = 1"><xsl:value-of select="$heading.1.bodyIndent"/></xsl:when>
                <xsl:when test="$lvl = 2"><xsl:value-of select="$heading.2.bodyIndent"/></xsl:when>
                <xsl:when test="$lvl = 3"><xsl:value-of select="$heading.3.bodyIndent"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$heading.4.bodyIndent"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="hupper">
            <xsl:choose>
                <xsl:when test="$lvl = 1"><xsl:value-of select="$heading.1.uppercase"/></xsl:when>
                <xsl:when test="$lvl = 2"><xsl:value-of select="$heading.2.uppercase"/></xsl:when>
                <xsl:when test="$lvl = 3"><xsl:value-of select="$heading.3.uppercase"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$heading.4.uppercase"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <!-- Off by default at every level (sections flow continuously); turn
             it on for a level (typically level 1, one section per Data
             Module) to start every heading at that level on a fresh page. -->
        <xsl:variable name="hbreak-level">
            <xsl:choose>
                <xsl:when test="$lvl = 1"><xsl:value-of select="$heading.1.pageBreakBefore"/></xsl:when>
                <xsl:when test="$lvl = 2"><xsl:value-of select="$heading.2.pageBreakBefore"/></xsl:when>
                <xsl:when test="$lvl = 3"><xsl:value-of select="$heading.3.pageBreakBefore"/></xsl:when>
                <xsl:otherwise><xsl:value-of select="$heading.4.pageBreakBefore"/></xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <!--
          A manual <pageBreak/> (see common.xsl) renders fine on its own when
          it sits among plain paragraphs, but "flat" rendering pulls EVERY
          section out to be rendered as its own separate item, in document
          order, regardless of what non-section content is interleaved with
          them — a pageBreak sitting between two nested sections would never
          actually get visited by anything, since neither this section's own
          apply-templates (which only sees ITS OWN non-section children) nor
          the sibling section's would encounter it in the right place. So
          instead, a pageBreak immediately before a section (as an actual
          preceding sibling, or as the last child of a preceding sibling
          section with no subsections of its own — the two places a manual
          break naturally ends up when authored "between these two steps")
          forces the break directly onto this heading instead of trying to
          render the marker as its own content.
        -->
        <xsl:variable name="hbreak-marker">
            <xsl:choose>
                <xsl:when test="preceding-sibling::*[1][self::pageBreak]">1</xsl:when>
                <xsl:when test="preceding-sibling::*[1][self::section]
                                and preceding-sibling::*[1]/*[last()][self::pageBreak]">1</xsl:when>
                <xsl:otherwise>0</xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <xsl:variable name="hbreak">
            <xsl:choose>
                <xsl:when test="$hbreak-level = '1' or $hbreak-marker = '1'">1</xsl:when>
                <xsl:otherwise>0</xsl:otherwise>
            </xsl:choose>
        </xsl:variable>
        <!--
          A plain inline "number, nbsp, title" block left the title starting
          wherever the number happened to end — different for "1.1" vs
          "1.1.1.1" — so it rarely lined up with the body-indent paragraphs
          below it. A list-block gives the number a fixed-width label column
          instead: the title (list-item-body) always starts at exactly
          $hbody, the same start-indent the paragraphs below use, regardless
          of how wide the number is.
        -->
        <xsl:variable name="hgap">
            <xsl:call-template name="mm-diff">
                <xsl:with-param name="a" select="$hbody"/>
                <xsl:with-param name="b" select="$hindent"/>
            </xsl:call-template>
        </xsl:variable>
        <fo:list-block id="{generate-id(.)}"
                       space-before="{$hsb}"
                       space-after="{$hsa}"
                       keep-with-next.within-page="always"
                       start-indent="{$hindent}"
                       provisional-distance-between-starts="{$hgap}"
                       provisional-label-separation="2mm">
            <xsl:if test="$hbreak = '1'">
                <xsl:attribute name="break-before">page</xsl:attribute>
            </xsl:if>
            <fo:list-item>
                <fo:list-item-label end-indent="label-end()">
                    <fo:block font-weight="bold" font-size="{$hsize}">
                        <xsl:call-template name="section-number"/>
                    </fo:block>
                </fo:list-item-label>
                <fo:list-item-body start-indent="body-start()">
                    <fo:block font-weight="bold" font-size="{$hsize}">
                        <!-- Anchor the heading so an internalRef/dmRef to this
                             section (or a data module) links straight to it. Only
                             the CANONICAL holder of an @id is anchored: when the
                             same @id occurs more than once (e.g. a data module
                             referenced by several pmEntries) element-id would fall
                             back to generate-id(.), which is exactly the id this
                             list-block already carries — emitting both would be a
                             duplicate-id FOP fatal. Cross-references resolve to the
                             first occurrence, so skipping the anchor on duplicates
                             loses nothing. -->
                        <xsl:choose>
                            <xsl:when test="@id and generate-id(.) = generate-id(key('by-id', @id)[1])">
                                <fo:inline id="{@id}">
                                    <xsl:choose>
                                        <xsl:when test="$hupper = '1'"><xsl:value-of select="translate(title, $lower, $upper)"/></xsl:when>
                                        <xsl:otherwise><xsl:value-of select="title"/></xsl:otherwise>
                                    </xsl:choose>
                                </fo:inline>
                            </xsl:when>
                            <xsl:when test="$hupper = '1'">
                                <xsl:value-of select="translate(title, $lower, $upper)"/>
                            </xsl:when>
                            <xsl:otherwise><xsl:value-of select="title"/></xsl:otherwise>
                        </xsl:choose>
                    </fo:block>
                </fo:list-item-body>
            </fo:list-item>
        </fo:list-block>
        <fo:block start-indent="{$hbody}">
            <xsl:apply-templates select="*[not(self::title or self::section)]"/>
        </fo:block>
    </xsl:template>

    <!-- a - b for two "<number>mm" length strings, e.g. mm-diff('14mm','8mm') -> '6mm'. -->
    <xsl:template name="mm-diff">
        <xsl:param name="a"/>
        <xsl:param name="b"/>
        <xsl:value-of select="number(substring-before($a, 'mm')) - number(substring-before($b, 'mm'))"/>
        <xsl:text>mm</xsl:text>
    </xsl:template>

    <xsl:template match="section/title | chapter/title"/>

</xsl:stylesheet>
