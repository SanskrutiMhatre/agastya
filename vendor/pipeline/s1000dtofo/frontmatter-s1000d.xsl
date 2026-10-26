<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: the S1000D-DEFAULT front matter

     An alternative to the JSS prelims, selected with
     $frontmatter.style = 's1000d'. Four pages, in the shape the S1000D
     reference stylesheets produce:

       title page             publication title, code, issue, illustration
       table of contents      one row per data module: title, its code,
                              issue date, applicability
       list of illustrations  every titled figure, under the module it
                              belongs to
       list of abbreviations  the acronyms harvested from the source

     Deliberately built on this engine's own furniture — page-sequence,
     page masters, running head and foot, margin notes — rather than ported
     from the reference pipeline, which reaches FO through DocBook. The
     structure follows the reference; the page around it stays consistent
     with the rest of the book, and every existing Setting keeps working.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

  <!--
    Both front-matter styles, so a publication can follow either convention:

      jss     the stencil prelims — title pages, proprietary notice,
              foreword, record of changes and the rest. The default, so no
              existing book changes because this arrived.
      s1000d  the four pages below.
  -->
  <xsl:param name="frontmatter.style">jss</xsl:param>

  <!-- Column headings, overridable like every other front-matter label. -->
  <xsl:param name="fm.label.s1000d.toc">Table of contents</xsl:param>
  <xsl:param name="fm.label.s1000d.loi">List of illustrations</xsl:param>
  <xsl:param name="fm.label.s1000d.loa">List of abbreviations</xsl:param>
  <xsl:param name="fm.label.s1000d.colChapter">Chapter</xsl:param>
  <xsl:param name="fm.label.s1000d.colTitle">Document title</xsl:param>
  <xsl:param name="fm.label.s1000d.colCode">Data module code</xsl:param>
  <xsl:param name="fm.label.s1000d.colCode2">Publication module code</xsl:param>
  <xsl:param name="fm.label.s1000d.colIssue">Issue date</xsl:param>
  <xsl:param name="fm.label.s1000d.colPage">Page</xsl:param>
  <xsl:param name="fm.label.s1000d.colApplic">Applicable to</xsl:param>
  <!--
    Both new toggles for the S1000D-style contents table. Chapter defaults
    off: it is a new column with no equivalent before this setting existed,
    so an existing book's TOC does not change shape until someone opts in.
    Page defaults on, matching what every book already shows.
  -->
  <xsl:param name="toc.s1000d.showChapter">0</xsl:param>
  <xsl:param name="toc.s1000d.showPage">1</xsl:param>
  <!--
    "Chap " + the pmEntry's position among its own siblings at each nesting
    level, dot-joined down from the outermost chapter — 1, 1.1, 1.4.1, 2.5.3.
    Matches the S1000D reference contents list, and the only numbering a
    pmEntry has anywhere in this pipeline: chapters are not otherwise
    numbered in the body, so the TOC computes it directly from pmEntry
    sibling position rather than reusing a heading number that does not
    exist.
  -->
  <xsl:template name="pmentry-number">
    <xsl:param name="entry"/>
    <xsl:if test="$entry/parent::pmEntry">
      <xsl:call-template name="pmentry-number">
        <xsl:with-param name="entry" select="$entry/parent::pmEntry"/>
      </xsl:call-template>
      <xsl:text>.</xsl:text>
    </xsl:if>
    <xsl:value-of select="count($entry/preceding-sibling::pmEntry) + 1"/>
  </xsl:template>
  <xsl:param name="fm.label.s1000d.colFigure">Figure</xsl:param>
  <xsl:param name="fm.label.s1000d.colFigTitle">Title</xsl:param>
  <xsl:param name="fm.label.s1000d.colAbbrev">Abbreviation</xsl:param>
  <xsl:param name="fm.label.s1000d.colDefinition">Definition</xsl:param>
  <xsl:param name="fm.label.s1000d.tocIntro">The listed documents are included in issue </xsl:param>
  <xsl:param name="fm.label.s1000d.issueNo">Issue No. </xsl:param>
  <!--
    The sentence under the contents heading is built from three pieces with
    the issue number and date between them, so each piece is its own label.
    One label for the whole sentence would have to carry the number, and there
    is no way to write "put the issue number here" in a text field.
  -->
  <xsl:param name="fm.label.s1000d.tocIntroDated">, dated </xsl:param>
  <xsl:param name="fm.label.s1000d.tocIntroEnd">, of this publication.</xsl:param>
  <xsl:param name="fm.label.s1000d.publisher">Publisher:</xsl:param>
  <xsl:param name="fm.label.s1000d.none">None</xsl:param>

  <!--
    Title-page artwork, in Settings > Front Matter.

    The illustration is bounded rather than sized: both are maxima and the
    scaling stays uniform, so the picture grows as large as fits inside them
    and keeps its proportions whatever artwork is supplied. Giving it a fixed
    width instead would stretch a square photograph into a strip.

    The width defaults to the portrait FIGURE cap, so an untouched project
    gets an illustration no wider than the pictures in its body text.
  -->
  <xsl:param name="fm.s1000d.image.width"><xsl:value-of select="concat($graphic.cap.portrait.w, 'mm')"/></xsl:param>
  <xsl:param name="fm.s1000d.image.height">120mm</xsl:param>
  <!-- The publisher's logo under "Publisher:". Height only: the width follows
       from the artwork's own proportions. -->
  <xsl:param name="fm.s1000d.logo.height">10mm</xsl:param>

  <!-- ==================================================================== -->
  <!--                    ENTRY POINT                                        -->
  <!-- ==================================================================== -->
  <!--
    Each page is its own sequence and each is padded to end on an even page,
    so the next always opens on a right-hand one — and the pad carries the
    "This page is intentionally left blank." legend, exactly as the JSS
    prelims and the body chapters do. The padding is gated on $blank.versos,
    so single-sided output still has none.

    They were built with last=0, which suppresses that padding. The pages
    then ran on from each other and a reader turning to the list of
    illustrations could find it on a verso, with no blank page and no legend
    anywhere in the front matter.
  -->
  <xsl:template name="s1000d-frontmatter">
    <xsl:call-template name="s1000d-title-page"/>
    <xsl:call-template name="s1000d-toc"/>
    <xsl:call-template name="s1000d-loi"/>
    <xsl:call-template name="s1000d-loa"/>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    SHARED BITS                                        -->
  <!-- ==================================================================== -->
  <!--
    The publication code, as it is printed: MODEL-ISSUER-NUMBER-VOLUME.

    Built here rather than reusing the body's dmCode template, which formats a
    DATA module code; a publication module code has a different shape.
  -->
  <xsl:template name="s1000d-pm-code">
    <xsl:variable name="c" select="/pm/identAndStatusSection/pmAddress/pmIdent/pmCode"/>
    <xsl:value-of select="concat($c/@modelIdentCode, '-', $c/@pmIssuer, '-', $c/@pmNumber, '-', $c/@pmVolume)"/>
  </xsl:template>

  <!-- A data module's issue date, as yyyy-mm-dd. -->
  <xsl:template name="s1000d-issue-date">
    <xsl:param name="dm"/>
    <xsl:variable name="d" select="$dm/identAndStatusSection/dmAddress/dmAddressItems/issueDate"/>
    <xsl:if test="$d">
      <xsl:value-of select="concat($d/@year, '-', $d/@month, '-', $d/@day)"/>
    </xsl:if>
  </xsl:template>

  <!--
    "techName – infoName", which is how the reference names a module. infoName
    is often absent, so the dash is only emitted when there is something after
    it.
  -->
  <xsl:template name="s1000d-dm-title">
    <xsl:param name="dm"/>
    <xsl:variable name="t" select="$dm/identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
    <xsl:value-of select="normalize-space($t/techName)"/>
    <xsl:if test="normalize-space($t/infoName) != ''">
      <xsl:text> – </xsl:text>
      <xsl:value-of select="normalize-space($t/infoName)"/>
    </xsl:if>
  </xsl:template>

  <!-- A ruled header cell. -->
  <xsl:template name="s1000d-th">
    <xsl:param name="t"/>
    <fo:table-cell border-bottom="1pt solid black" padding="1.5mm" padding-left="0mm">
      <fo:block font-weight="bold"><xsl:copy-of select="$t"/></fo:block>
    </fo:table-cell>
  </xsl:template>

  <!-- A body cell. Rules are horizontal only, as in the reference. -->
  <xsl:template name="s1000d-td">
    <xsl:param name="t"/>
    <xsl:param name="link"/>
    <xsl:param name="bold">0</xsl:param>
    <fo:table-cell border-bottom="0.4pt solid #999999" padding="1.5mm" padding-left="0mm">
      <fo:block>
        <xsl:if test="$bold != '0'">
          <xsl:attribute name="font-weight">bold</xsl:attribute>
        </xsl:if>
        <xsl:choose>
          <xsl:when test="$link != ''">
            <fo:basic-link internal-destination="{$link}" color="#0000CC">
              <xsl:copy-of select="$t"/>
            </fo:basic-link>
          </xsl:when>
          <xsl:otherwise><xsl:copy-of select="$t"/></xsl:otherwise>
        </xsl:choose>
      </fo:block>
    </fo:table-cell>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    TITLE PAGE                                         -->
  <!-- ==================================================================== -->
  <xsl:template name="s1000d-title-page">
    <xsl:variable name="issue" select="/pm/identAndStatusSection/pmAddress/pmIdent/issueInfo"/>
    <xsl:variable name="date" select="/pm/identAndStatusSection/pmAddress/pmAddressItems/issueDate"/>
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="last" select="1"/>
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <fo:block font-size="{$heading1-size}" font-weight="bold" space-before="18mm" space-after="2mm">
            <xsl:value-of select="/pm/identAndStatusSection/pmAddress/pmAddressItems/pmTitle"/>
          </fo:block>
          <xsl:if test="/pm/identAndStatusSection/pmAddress/pmAddressItems/shortPmTitle">
            <fo:block font-size="{$heading2-size}" font-weight="bold" space-after="8mm">
              <xsl:value-of select="/pm/identAndStatusSection/pmAddress/pmAddressItems/shortPmTitle"/>
            </fo:block>
          </xsl:if>
          <fo:block font-weight="bold" space-after="1.5mm">
            <xsl:call-template name="s1000d-pm-code"/>
          </fo:block>
          <fo:block font-weight="bold" space-after="10mm">
            <xsl:value-of select="$fm.label.s1000d.issueNo"/>
            <xsl:value-of select="$issue/@issueNumber"/>
            <xsl:if test="$date">
              <xsl:text>, </xsl:text>
              <xsl:value-of select="concat($date/@year, '-', $date/@month, '-', $date/@day)"/>
            </xsl:if>
          </fo:block>

          <!-- The system illustration, when Settings supplies one. Addressed
               by @src like every other front-matter picture. -->
          <xsl:if test="/pm/frontmatter/systemNamePage/graphic/@src">
            <fo:block space-after="10mm">
              <!--
                height, not max-height. max-height caps the VIEWPORT but not
                the picture: FOP scaled the image to the width alone and drew
                it 145mm tall inside a 120mm box, so it ran over the publisher
                block beneath it. Giving both dimensions makes the box exactly
                the bounds and fits the picture inside them, so whatever comes
                next always starts below it.
              -->
              <fo:external-graphic src="url('{/pm/frontmatter/systemNamePage/graphic/@src}')"
                                   width="{$fm.s1000d.image.width}"
                                   height="{$fm.s1000d.image.height}"
                                   content-width="scale-down-to-fit"
                                   content-height="scale-down-to-fit"
                                   scaling="uniform"/>
            </fo:block>
          </xsl:if>

          <fo:block space-before="6mm">
            <xsl:value-of select="$fm.label.s1000d.publisher"/>
          </fo:block>
          <xsl:variable name="pubLogo"
            select="(/pm/bookmeta/publishers/publisher[1]/logo/@src
                   | /pm/identAndStatusSection/pmStatus/logo/symbol/@infoEntityIdent)[1]"/>
          <xsl:if test="/pm/bookmeta/publishers/publisher[1]/logo/@src">
            <fo:block space-before="2mm">
              <!-- Per-publisher logo/@height in Settings > Publishers overrides
                   the general "Publisher logo height" setting below, which stays
                   the default for a publisher that has not set its own. -->
              <fo:external-graphic src="url('{/pm/bookmeta/publishers/publisher[1]/logo/@src}')"
                                   content-width="scale-down-to-fit"
                                   scaling="uniform">
                <xsl:attribute name="content-height">
                  <xsl:choose>
                    <xsl:when test="/pm/bookmeta/publishers/publisher[1]/logo/@height">
                      <xsl:value-of select="/pm/bookmeta/publishers/publisher[1]/logo/@height"/>
                    </xsl:when>
                    <xsl:otherwise><xsl:value-of select="$fm.s1000d.logo.height"/></xsl:otherwise>
                  </xsl:choose>
                </xsl:attribute>
                <xsl:if test="/pm/bookmeta/publishers/publisher[1]/logo/@width">
                  <xsl:attribute name="width">
                    <xsl:value-of select="/pm/bookmeta/publishers/publisher[1]/logo/@width"/>
                  </xsl:attribute>
                </xsl:if>
              </fo:external-graphic>
            </fo:block>
          </xsl:if>
          <fo:block font-size="{$table-font-size}">
            <xsl:value-of select="/pm/identAndStatusSection/pmStatus/responsiblePartnerCompany/enterpriseName"/>
          </fo:block>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    TABLE OF CONTENTS                                  -->
  <!-- ==================================================================== -->
  <!--
    One row per data module, in publication order, with the code it is filed
    under and the issue it carries — which is what makes this a CONTENTS list
    in the S1000D sense rather than a reading order: it says which issue of
    which module the book contains.
  -->
  <xsl:template name="s1000d-toc">
    <xsl:variable name="issue" select="/pm/identAndStatusSection/pmAddress/pmIdent/issueInfo"/>
    <xsl:variable name="date" select="/pm/identAndStatusSection/pmAddress/pmAddressItems/issueDate"/>
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="last" select="1"/>
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <xsl:call-template name="page-title">
            <xsl:with-param name="text" select="$fm.label.s1000d.toc"/>
          </xsl:call-template>
          <fo:block text-align="center" space-after="6mm" font-size="{$table-font-size}">
            <xsl:value-of select="$fm.label.s1000d.tocIntro"/>
            <xsl:value-of select="$issue/@issueNumber"/>
            <xsl:if test="$date">
              <xsl:value-of select="$fm.label.s1000d.tocIntroDated"/>
              <xsl:value-of select="concat($date/@year, '-', $date/@month, '-', $date/@day)"/>
            </xsl:if>
            <xsl:value-of select="$fm.label.s1000d.tocIntroEnd"/>
          </fo:block>
          <fo:table table-layout="fixed" width="100%" font-size="{$table-font-size}">
            <xsl:if test="$toc.s1000d.showChapter = '1'">
              <fo:table-column column-width="proportional-column-width(10)"/>
            </xsl:if>
            <fo:table-column column-width="proportional-column-width(31)"/>
            <fo:table-column column-width="proportional-column-width(28)"/>
            <fo:table-column column-width="proportional-column-width(15)"/>
            <xsl:if test="$toc.s1000d.showPage = '1'">
              <fo:table-column column-width="proportional-column-width(9)"/>
            </xsl:if>
            <fo:table-column column-width="proportional-column-width(17)"/>
            <fo:table-header>
              <fo:table-row>
                <xsl:if test="$toc.s1000d.showChapter = '1'">
                  <xsl:call-template name="s1000d-th">
                    <xsl:with-param name="t" select="$fm.label.s1000d.colChapter"/>
                  </xsl:call-template>
                </xsl:if>
                <xsl:call-template name="s1000d-th">
                  <xsl:with-param name="t" select="$fm.label.s1000d.colTitle"/>
                </xsl:call-template>
                <fo:table-cell border-bottom="1pt solid black" padding="1.5mm" padding-left="0mm">
                  <fo:block font-weight="bold"><xsl:value-of select="$fm.label.s1000d.colCode"/></fo:block>
                  <fo:block font-weight="bold"><xsl:value-of select="$fm.label.s1000d.colCode2"/></fo:block>
                </fo:table-cell>
                <xsl:call-template name="s1000d-th">
                  <xsl:with-param name="t" select="$fm.label.s1000d.colIssue"/>
                </xsl:call-template>
                <xsl:if test="$toc.s1000d.showPage = '1'">
                  <xsl:call-template name="s1000d-th">
                    <xsl:with-param name="t" select="$fm.label.s1000d.colPage"/>
                  </xsl:call-template>
                </xsl:if>
                <xsl:call-template name="s1000d-th">
                  <xsl:with-param name="t" select="$fm.label.s1000d.colApplic"/>
                </xsl:call-template>
              </fo:table-row>
            </fo:table-header>
            <fo:table-body>
              <xsl:for-each select="//dmodule">
                <xsl:variable name="dm" select="."/>
                <fo:table-row>
                  <xsl:if test="$toc.s1000d.showChapter = '1'">
                    <fo:table-cell border-bottom="0.4pt solid #999999" padding="1.5mm" padding-left="0mm">
                      <fo:block>
                        <xsl:choose>
                          <xsl:when test="$dm/ancestor::pmEntry">
                            <fo:basic-link internal-destination="{concat('content-start-', generate-id($dm))}" color="#0000CC">
                              <xsl:text>Chap </xsl:text>
                              <xsl:call-template name="pmentry-number">
                                <xsl:with-param name="entry" select="$dm/ancestor::pmEntry[1]"/>
                              </xsl:call-template>
                            </fo:basic-link>
                          </xsl:when>
                        </xsl:choose>
                      </fo:block>
                    </fo:table-cell>
                  </xsl:if>
                  <xsl:call-template name="s1000d-td">
                    <xsl:with-param name="t">
                      <xsl:call-template name="s1000d-dm-title">
                        <xsl:with-param name="dm" select="$dm"/>
                      </xsl:call-template>
                    </xsl:with-param>
                  </xsl:call-template>
                  <xsl:call-template name="s1000d-td">
                    <xsl:with-param name="link" select="concat('content-start-', generate-id($dm))"/>
                    <xsl:with-param name="t">
                      <xsl:for-each select="$dm">
                        <xsl:call-template name="get.dmcode"/>
                      </xsl:for-each>
                    </xsl:with-param>
                  </xsl:call-template>
                  <xsl:call-template name="s1000d-td">
                    <xsl:with-param name="t">
                      <xsl:call-template name="s1000d-issue-date">
                        <xsl:with-param name="dm" select="$dm"/>
                      </xsl:call-template>
                    </xsl:with-param>
                  </xsl:call-template>
                  <xsl:if test="$toc.s1000d.showPage = '1'">
                    <fo:table-cell border-bottom="0.4pt solid #999999" padding="1.5mm" padding-left="0mm">
                      <fo:block>
                        <fo:basic-link internal-destination="{concat('content-start-', generate-id($dm))}" color="#0000CC">
                          <fo:page-number-citation ref-id="{concat('content-start-', generate-id($dm))}"/>
                        </fo:basic-link>
                      </fo:block>
                    </fo:table-cell>
                  </xsl:if>
                  <xsl:call-template name="s1000d-td">
                    <xsl:with-param name="t"
                      select="normalize-space($dm/identAndStatusSection/dmStatus/applic/displayText/simplePara)"/>
                  </xsl:call-template>
                </fo:table-row>
              </xsl:for-each>
            </fo:table-body>
          </fo:table>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    LIST OF ILLUSTRATIONS                              -->
  <!-- ==================================================================== -->
  <!--
    Grouped by data module: the code is printed once, on the row of its first
    figure, and the rest of that module's figures leave the cell blank. That
    is what the reference does, and it is what makes a long list readable.
  -->
  <xsl:template name="s1000d-loi">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="last" select="1"/>
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <xsl:call-template name="page-title">
            <xsl:with-param name="text" select="$fm.label.s1000d.loi"/>
          </xsl:call-template>
          <fo:table table-layout="fixed" width="100%" font-size="{$table-font-size}">
            <fo:table-column column-width="proportional-column-width(38)"/>
            <fo:table-column column-width="proportional-column-width(12)"/>
            <fo:table-column column-width="proportional-column-width(50)"/>
            <fo:table-header>
              <fo:table-row>
                <xsl:call-template name="s1000d-th">
                  <xsl:with-param name="t" select="$fm.label.s1000d.colCode"/>
                </xsl:call-template>
                <xsl:call-template name="s1000d-th">
                  <xsl:with-param name="t" select="$fm.label.s1000d.colFigure"/>
                </xsl:call-template>
                <xsl:call-template name="s1000d-th">
                  <xsl:with-param name="t" select="$fm.label.s1000d.colFigTitle"/>
                </xsl:call-template>
              </fo:table-row>
            </fo:table-header>
            <fo:table-body>
              <!--
                A publication with no titled figure still has to produce a
                table body: FOP requires at least one row, so the empty case
                aborted the whole build with a validation error naming
                fo:table-body and a character offset, which tells an author
                nothing about the book they wrote. The list of abbreviations
                below already carried its "None" row; this one did not.
              -->
              <xsl:if test="not(//dmodule//figure[title])">
                <fo:table-row>
                  <xsl:call-template name="s1000d-td">
                    <xsl:with-param name="t" select="$fm.label.s1000d.none"/>
                  </xsl:call-template>
                  <xsl:call-template name="s1000d-td"><xsl:with-param name="t"/></xsl:call-template>
                  <xsl:call-template name="s1000d-td"><xsl:with-param name="t"/></xsl:call-template>
                </fo:table-row>
              </xsl:if>
              <xsl:for-each select="//dmodule">
                <xsl:variable name="dm" select="."/>
                <xsl:for-each select=".//figure[title]">
                  <!--
                    The id FOP gave this figure, so the row can link to it.
                    Produced by the same template the figure itself used, which
                    is what guarantees the two agree; hand-building the id here
                    would give a link that silently goes nowhere.
                  -->
                  <xsl:variable name="fig-id">
                    <xsl:call-template name="unique-id"/>
                  </xsl:variable>
                  <fo:table-row>
                    <xsl:call-template name="s1000d-td">
                      <xsl:with-param name="t">
                        <!-- Only on the module's FIRST figure. -->
                        <xsl:if test="position() = 1">
                          <xsl:for-each select="$dm">
                            <xsl:call-template name="get.dmcode"/>
                          </xsl:for-each>
                        </xsl:if>
                      </xsl:with-param>
                    </xsl:call-template>
                    <xsl:call-template name="s1000d-td">
                      <xsl:with-param name="link" select="$fig-id"/>
                      <xsl:with-param name="t">
                        <!--
                          The SAME number the caption prints, not this row's
                          position. The list holds only figures that have a
                          title, while the caption numbers every figure in the
                          module — so a single untitled figure made every row
                          below it name a figure that was not the one it
                          pointed at. Harmless while the list was inert; a
                          clickable list that lands on "Fig 5" while calling it
                          "Fig 4" is worse than no link at all.
                        -->
                        <xsl:text>Fig </xsl:text>
                        <xsl:apply-templates select="." mode="number"/>
                      </xsl:with-param>
                    </xsl:call-template>
                    <xsl:call-template name="s1000d-td">
                      <xsl:with-param name="link" select="$fig-id"/>
                      <xsl:with-param name="t" select="normalize-space(title)"/>
                    </xsl:call-template>
                  </fo:table-row>
                </xsl:for-each>
              </xsl:for-each>
            </fo:table-body>
          </fo:table>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    LIST OF ABBREVIATIONS                              -->
  <!-- ==================================================================== -->
  <!--
    From the <acronym> elements in the source. With none present the page
    still prints, carrying a single "None" row — the reference does the same,
    because a publication is expected to have the page whether or not it has
    any abbreviations.
  -->
  <xsl:template name="s1000d-loa">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="last" select="1"/>
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <xsl:call-template name="page-title">
            <xsl:with-param name="text" select="$fm.label.s1000d.loa"/>
          </xsl:call-template>
          <fo:table table-layout="fixed" width="100%" font-size="{$table-font-size}">
            <fo:table-column column-width="proportional-column-width(25)"/>
            <fo:table-column column-width="proportional-column-width(75)"/>
            <fo:table-header>
              <fo:table-row>
                <xsl:call-template name="s1000d-th">
                  <xsl:with-param name="t" select="$fm.label.s1000d.colAbbrev"/>
                </xsl:call-template>
                <xsl:call-template name="s1000d-th">
                  <xsl:with-param name="t" select="$fm.label.s1000d.colDefinition"/>
                </xsl:call-template>
              </fo:table-row>
            </fo:table-header>
            <fo:table-body>
              <xsl:variable name="terms" select="//acronym[acronymTerm]"/>
              <xsl:choose>
                <xsl:when test="$terms">
                  <xsl:for-each select="$terms">
                    <!--
                      Alphabetical, folded to capitals for the sort key: XSLT
                      1.0 orders by code point, so unfolded every lower-case
                      term would file after every upper-case one.
                    -->
                    <xsl:sort select="translate(normalize-space(acronymTerm), $lower, $upper)"/>
                    <!-- One row per distinct term; a term used ten times is
                         still one abbreviation. The test is on preceding::,
                         which is document order and so is unaffected by the
                         sort above — it keeps the first occurrence in the
                         source, wherever that lands on the page. -->
                    <xsl:variable name="t" select="normalize-space(acronymTerm)"/>
                    <xsl:if test="not(preceding::acronym[normalize-space(acronymTerm) = $t])">
                      <fo:table-row>
                        <xsl:call-template name="s1000d-td">
                          <xsl:with-param name="t" select="$t"/>
                          <xsl:with-param name="bold">1</xsl:with-param>
                        </xsl:call-template>
                        <xsl:call-template name="s1000d-td">
                          <xsl:with-param name="t" select="normalize-space(acronymDefinition)"/>
                        </xsl:call-template>
                      </fo:table-row>
                    </xsl:if>
                  </xsl:for-each>
                </xsl:when>
                <xsl:otherwise>
                  <fo:table-row>
                    <xsl:call-template name="s1000d-td">
                      <xsl:with-param name="t" select="$fm.label.s1000d.none"/>
                    </xsl:call-template>
                    <xsl:call-template name="s1000d-td"><xsl:with-param name="t"/></xsl:call-template>
                  </fo:table-row>
                </xsl:otherwise>
              </xsl:choose>
            </fo:table-body>
          </fo:table>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

</xsl:stylesheet>
