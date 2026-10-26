<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Headers and Footers Module
     
     Contains templates for page headers and footers with markers.
     ******************************************************************** -->

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

  <!-- ==================================================================== -->
  <!--                         HEADER CONTENT                                -->
  <!-- ==================================================================== -->
  <xsl:template name="header-content">
    <!-- '1' on left-hand (even) pages. -->
    <xsl:param name="verso">0</xsl:param>
    <fo:block font-family="{$font-stack}" font-size="{$header-footer-size}">
      <fo:table table-layout="fixed" width="100%" 
          border-bottom-width="0.5pt" 
          border-bottom-style="solid" 
          border-bottom-color="black">
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-body>
          <fo:table-row>
            <!-- Outer cell. On a verso the logo and the publication code swap
                 ends, so each stays on the outer edge of the spread — the same
                 mirroring the running foot already does. Without it the header
                 sat identically on both sides while the footer alternated, and
                 the two disagreed on every left-hand page.

                 No fixed height: the running head must fit inside whatever
                 $region-before-extent is configured. A hardcoded 15mm was
                 taller than a 14mm header region, so the table's bottom rule
                 spilled out of the region and printed across the first line of
                 the page. Sizing to content keeps it inside any extent. -->
            <fo:table-cell text-align="start">
              <fo:block>
                <xsl:attribute name="font-weight">
                  <xsl:choose>
                    <xsl:when test="$verso = '1'">bold</xsl:when>
                    <xsl:otherwise>normal</xsl:otherwise>
                  </xsl:choose>
                </xsl:attribute>
                <fo:retrieve-marker retrieve-position="first-including-carryover"
                    retrieve-boundary="page-sequence">
                  <xsl:attribute name="retrieve-class-name">
                    <xsl:choose>
                      <xsl:when test="$verso = '1'">publication.code</xsl:when>
                      <xsl:otherwise>page.header.logo</xsl:otherwise>
                    </xsl:choose>
                  </xsl:attribute>
                </fo:retrieve-marker>
              </fo:block>
            </fo:table-cell>
            <!-- Classification stays centred on both sides. -->
            <fo:table-cell text-align="{$classification.align}">
              <fo:block>
                <xsl:call-template name="classification-style"/>
                <fo:retrieve-marker retrieve-class-name="chapter.classification"
                    retrieve-position="first-including-carryover"
                    retrieve-boundary="page-sequence"/>
              </fo:block>
              <!--
                The release this PDF is on, under the classification.

                $release.label was declared by this pipeline but never printed,
                so an approved release showed in the JSS-rendered book and was
                invisible in an S1000D-rendered one — the same publication
                reporting two different things depending on its engine. Empty
                for an unreleased build (the NOT RELEASED watermark covers that
                case), so an unreleased book's head is exactly as it was.
              -->
              <xsl:if test="normalize-space($release.label) != ''">
                <fo:block font-weight="bold"><xsl:value-of select="$release.label"/></fo:block>
              </xsl:if>
            </fo:table-cell>
            <fo:table-cell text-align="right">
              <fo:block>
                <xsl:attribute name="font-weight">
                  <xsl:choose>
                    <xsl:when test="$verso = '1'">normal</xsl:when>
                    <xsl:otherwise>bold</xsl:otherwise>
                  </xsl:choose>
                </xsl:attribute>
                <fo:retrieve-marker retrieve-position="first-including-carryover"
                    retrieve-boundary="page-sequence">
                  <xsl:attribute name="retrieve-class-name">
                    <xsl:choose>
                      <xsl:when test="$verso = '1'">page.header.logo</xsl:when>
                      <xsl:otherwise>publication.code</xsl:otherwise>
                    </xsl:choose>
                  </xsl:attribute>
                </fo:retrieve-marker>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
        </fo:table-body>
      </fo:table>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    ODD PAGE FOOTER CONTENT                            -->
  <!-- ==================================================================== -->
  <xsl:template name="footer-content-odd">
    <!-- The page this footer is actually being drawn on. Defaults to
         $page-height, which is right for the ordinary (portrait) page
         sequence; see the note on side-notes below for why this has to be
         passed in rather than worked out here. -->
    <xsl:param name="page-h" select="$page-height"/>
    <!-- Not previously declared or forwarded here at all — see the note
         just below on why that mattered and why it's declared now. -->
    <xsl:param name="page-w" select="$page-width"/>
    <!--
      side-notes positions its text against $page-w, which this template
      never actually forwarded to it — only page-h ever reached side-notes,
      so on a landscape page (page-h/page-w = the swapped dimensions) the
      note's horizontal offset silently fell back to side-notes' own
      default, the ordinary PORTRAIT page width. The result sat well inside
      the true right edge of the wider landscape page and overlapped body
      content spilling further right than a portrait page ever would.

      Checking page-h alone is not enough to detect landscape: A3's own
      page-h is a literal "297mm" (page-sequence-a3-landscape in
      pagesetup.xsl), which on an A4-paper-size document coincidentally
      equals the ordinary portrait $page-height default, and would have
      read as "not landscape" for the one orientation where the note is
      furthest wrong. page-w still differs (A3 passes "420mm" against a
      210mm default), so checking both dimensions catches every case
      page-sequence-landscape and page-sequence-a3-landscape actually use.

      Suppressed on landscape rather than threading page-w through and
      recomputing the offset: the note is decorative furniture, not part of
      the technical content, and isn't needed on the handful of landscape
      pages a book has.
    -->
    <xsl:if test="$page-h = $page-height and $page-w = $page-width">
      <xsl:call-template name="side-notes">
        <xsl:with-param name="side">right</xsl:with-param>
        <xsl:with-param name="page-h" select="$page-h"/>
      </xsl:call-template>
    </xsl:if>
    <fo:block font-family="{$font-stack}" font-size="{$header-footer-size}">
      <fo:table width="100%" table-layout="fixed" 
          border-top-width="0.5pt" 
          border-top-style="solid" 
          border-top-color="black">
        <!--
          Three equal columns, so the classification can sit in a genuinely
          centred one. With two columns it was centred within its own HALF of
          the page, which put it about a quarter of the way across and looked
          like a mistake.
        -->
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-body>
          <!-- Row 1: Applicability and DMC -->
          <fo:table-row>
            <fo:table-cell number-columns-spanned="2" text-align="left">
              <fo:block>
                <xsl:value-of select="$applic.prefix"/>
                <fo:retrieve-marker retrieve-class-name="chapter.applicability" 
                    retrieve-position="first-including-carryover" 
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
            <fo:table-cell text-align="right">
              <fo:block font-weight="bold">
                <fo:retrieve-marker retrieve-class-name="chapter.data.module.code" 
                    retrieve-position="first-including-carryover" 
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
          <!-- Row 2: classification centred, issue date and folio at the end -->
          <fo:table-row>
            <fo:table-cell><fo:block/></fo:table-cell>
            <fo:table-cell text-align="{$classification.align}">
              <fo:block>
                <xsl:call-template name="classification-style"/>
                <fo:retrieve-marker retrieve-class-name="chapter.classification" 
                    retrieve-position="first-including-carryover" 
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
            <fo:table-cell text-align="right">
              <fo:block font-weight="bold">
                <fo:retrieve-marker retrieve-class-name="chapter.issue.date"
                    retrieve-position="first-including-carryover"
                    retrieve-boundary="page-sequence"/>
                <xsl:text>  Page </xsl:text>
                <fo:page-number/>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
          <!--
            Row 3: the end-of-module line, below the classification — empty,
            and so occupying no visible space, on every page but a module's
            actual last. The cell carries no padding of its own for the same
            reason: padding is painted whether or not the block inside it has
            anything in it, and would have put a blank gap under Row 2 on
            every ordinary page.
          -->
          <fo:table-row>
            <fo:table-cell number-columns-spanned="3" text-align="center">
              <fo:block font-weight="bold">
                <fo:retrieve-marker retrieve-class-name="chapter.end.of.dm"
                    retrieve-position="first-including-carryover"
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
        </fo:table-body>
      </fo:table>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    EVEN PAGE FOOTER CONTENT                           -->
  <!-- ==================================================================== -->
  <xsl:template name="footer-content-even">
    <xsl:param name="page-h" select="$page-height"/>
    <!-- See the identical note in footer-content-odd for why both
         dimensions are checked before showing the side notes at all. -->
    <xsl:param name="page-w" select="$page-width"/>
    <xsl:if test="$page-h = $page-height and $page-w = $page-width">
      <xsl:call-template name="side-notes">
        <xsl:with-param name="side">left</xsl:with-param>
        <xsl:with-param name="page-h" select="$page-h"/>
      </xsl:call-template>
    </xsl:if>
    <fo:block font-family="{$font-stack}" font-size="{$header-footer-size}">
      <fo:table width="100%" table-layout="fixed" 
          border-top-width="0.5pt" 
          border-top-style="solid" 
          border-top-color="black">
        <!-- Three columns, mirroring the odd footer; see the note there. -->
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-body>
          <!-- Row 1: DMC and Applicability -->
          <fo:table-row>
            <fo:table-cell number-columns-spanned="2" text-align="left">
              <fo:block font-weight="bold">
                <fo:retrieve-marker retrieve-class-name="chapter.data.module.code" 
                    retrieve-position="first-including-carryover" 
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
            <fo:table-cell text-align="right">
              <fo:block>
                <xsl:value-of select="$applic.prefix"/>
                <fo:retrieve-marker retrieve-class-name="chapter.applicability" 
                    retrieve-position="first-including-carryover" 
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
          <!-- Row 2: folio and issue date at the binding edge, classification centred -->
          <fo:table-row>
            <fo:table-cell text-align="left">
              <fo:block font-weight="bold">
                <xsl:text>Page </xsl:text>
                <fo:page-number/>
                <xsl:text>  </xsl:text>
                <fo:retrieve-marker retrieve-class-name="chapter.issue.date" 
                    retrieve-position="first-including-carryover" 
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
            <fo:table-cell text-align="{$classification.align}">
              <fo:block>
                <xsl:call-template name="classification-style"/>
                <fo:retrieve-marker retrieve-class-name="chapter.classification" 
                    retrieve-position="first-including-carryover" 
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
            <fo:table-cell><fo:block/></fo:table-cell>
          </fo:table-row>
          <!-- Row 3: the end-of-module line, below the classification. See
               the matching note in the odd footer, above. -->
          <fo:table-row>
            <fo:table-cell number-columns-spanned="3" text-align="center">
              <fo:block font-weight="bold">
                <fo:retrieve-marker retrieve-class-name="chapter.end.of.dm"
                    retrieve-position="first-including-carryover"
                    retrieve-boundary="page-sequence"/>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
        </fo:table-body>
      </fo:table>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    MARKER GENERATION TEMPLATES                        -->
  <!-- ==================================================================== -->
  <xsl:template name="generate-markers">
    <!-- Classification marker -->
    <!--
      Classification, issue date and publication code all fall back to the
      PUBLICATION module.

      generate-markers is called with a data module as its context for body
      pages and with the <pm> itself for front matter, where none of the
      dmStatus/dmAddress paths exist. Without a fallback the front matter
      printed its footer rule with no classification and no date beneath it —
      on the very pages a reader checks the classification first.
    -->
    <fo:marker marker-class-name="chapter.classification">
      <xsl:choose>
        <xsl:when test="identAndStatusSection/dmStatus/security">
          <xsl:apply-templates select="identAndStatusSection/dmStatus/security"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="/pm/identAndStatusSection/pmStatus/security"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:marker>
    
    <!-- Applicability marker -->
    <!--
      Applicability, from the data module when it states one and from the
      PUBLICATION module otherwise.

      The fallback is what makes the footer useful. A data module commonly
      carries <applic><displayText/></applic> — the element present and empty,
      because applicability is declared once for the publication and inherited
      rather than repeated on every module. Reading only the module's own
      value printed "Applicable to:" followed by nothing on every page of such
      a book, and on the front matter, whose pages are not data modules at all
      and never had a value to read.

      Tested for non-blank rather than for existence, since the empty element
      is exactly the case that has to fall through.
    -->
    <fo:marker marker-class-name="chapter.applicability">
      <xsl:variable name="dm.applic"
        select="normalize-space(identAndStatusSection/dmStatus/applic/displayText/simplePara)"/>
      <xsl:choose>
        <xsl:when test="$dm.applic != ''"><xsl:value-of select="$dm.applic"/></xsl:when>
        <xsl:otherwise>
          <xsl:value-of
            select="normalize-space(/pm/identAndStatusSection/pmStatus/applic/displayText/simplePara)"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:marker>
    
    <!-- Data module code marker -->
    <fo:marker marker-class-name="chapter.data.module.code">
      <xsl:apply-templates select="identAndStatusSection/dmAddress/dmIdent/identExtension"/>
      <xsl:apply-templates select="identAndStatusSection/dmAddress/dmIdent/dmCode"/>
    </fo:marker>
    
    <!-- Issue date marker -->
    <fo:marker marker-class-name="chapter.issue.date">
      <xsl:choose>
        <xsl:when test="identAndStatusSection/dmAddress/dmAddressItems/issueDate">
          <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/issueDate"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="/pm/identAndStatusSection/pmAddress/pmAddressItems/issueDate"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:marker>
    
    <!-- Publication code marker -->
    <fo:marker marker-class-name="publication.code">
      <xsl:choose>
        <!-- Set in Settings: replaces the line outright. -->
        <xsl:when test="normalize-space($header.publication.text) != ''">
          <xsl:value-of select="$header.publication.text"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:choose>
            <xsl:when test="identAndStatusSection/dmAddress/dmIdent/dmCode/@modelIdentCode">
              <xsl:value-of select="identAndStatusSection/dmAddress/dmIdent/dmCode/@modelIdentCode"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="/pm/identAndStatusSection/pmAddress/pmIdent/pmCode/@modelIdentCode"/>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:value-of select="$header.publication.suffix"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:marker>
    
    <!-- Logo marker: try dmodule logo first, then fall back to PM logo -->
    <fo:marker marker-class-name="page.header.logo">
      <xsl:choose>
        <xsl:when test="identAndStatusSection/dmStatus/logo">
          <xsl:apply-templates select="identAndStatusSection/dmStatus/logo"/>
        </xsl:when>
        <xsl:when test="/pm/identAndStatusSection/pmStatus/logo">
          <xsl:apply-templates select="/pm/identAndStatusSection/pmStatus/logo"/>
        </xsl:when>
      </xsl:choose>
    </fo:marker>
  </xsl:template>

  <!--
    Strips the unit off a length and returns the number, so two lengths can be
    added or subtracted. XSLT 1.0 has no length arithmetic, and the page width
    and the margin are both configurable, so neither can be assumed to be in
    millimetres.
  -->
  <xsl:template name="length-number">
    <xsl:param name="v"/>
    <xsl:value-of select="number(translate($v, translate($v, '0123456789.', ''), ''))"/>
  </xsl:template>
  <xsl:template name="length-unit">
    <xsl:param name="v"/>
    <xsl:value-of select="translate($v, '0123456789.', '')"/>
  </xsl:template>

  <!--
    One line of sideways text in the outer margin, repeated on every page
    because it is emitted from the footer's static-content.

    absolute-position="fixed" is relative to the page, so this escapes the
    footer region it is declared in and can sit anywhere. Anchored by
    top/left: FOP renders that and silently drops a container anchored by
    bottom/right, which is worth knowing before "improving" it.

    width is the LONG side and height the narrow band, with the whole box then
    turned by reference-orientation. Sized the other way round the text wraps
    after every word and runs down the page one word per line. wrap-option
    keeps it to a single line whatever the publisher types.
  -->
  <xsl:template name="side-note-line">
    <xsl:param name="text"/>
    <xsl:param name="top"/>
    <!-- 'right' on a recto, 'left' on a verso: the OUTER margin, which is the
         side away from the binding and so the side that is actually visible
         on a closed book. -->
    <xsl:param name="side">right</xsl:param>
    <!--
      The page this line is actually being drawn on. Defaults to $page-width,
      right for the ordinary page sequence, but a landscape page's rendered
      width is $page-height's value, not $page-width's — the two are swapped
      on the simple-page-master, and $page-width itself is one fixed number
      for the whole stylesheet regardless of which master is in play. Using it
      unconditionally here anchored the outer-margin line 87mm further right
      than a landscape page actually is (297mm assumed against a 210mm page),
      which put it off the trimmed edge entirely.

      Threaded in as a parameter rather than detected here, because a
      block-container anchored by "right" instead of computing "left" from a
      width would sidestep the whole problem — except FOP silently drops a
      fixed-position container anchored that way, so a real width is the only
      option. Each page-sequence template already knows its own orientation
      structurally (portrait and landscape are different templates), which is
      the one place this is genuinely known without guessing.
    -->
    <xsl:param name="page-w" select="$page-width"/>
    <xsl:if test="normalize-space($text) != ''">
      <xsl:variable name="pw">
        <xsl:call-template name="length-number"><xsl:with-param name="v" select="$page-w"/></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="unit">
        <xsl:call-template name="length-unit"><xsl:with-param name="v" select="$page-w"/></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="gap">
        <xsl:call-template name="length-number"><xsl:with-param name="v" select="$side.note.margin"/></xsl:call-template>
      </xsl:variable>
      <!-- Measured from the left page edge either way, because that is the
           only anchor FOP honours here. -->
      <xsl:variable name="x">
        <xsl:choose>
          <xsl:when test="$side = 'left'"><xsl:value-of select="concat($gap, $unit)"/></xsl:when>
          <xsl:otherwise><xsl:value-of select="concat($pw - $gap, $unit)"/></xsl:otherwise>
        </xsl:choose>
      </xsl:variable>
      <fo:block-container absolute-position="fixed"
                          top="{$top}"
                          left="{$x}"
                          width="{$side.note.length}"
                          height="5mm"
                          reference-orientation="90">
        <fo:block font-size="{$side.note.font.size}" wrap-option="no-wrap">
          <xsl:value-of select="$text"/>
        </fo:block>
      </fo:block-container>
    </xsl:if>
  </xsl:template>

  <!--
    Both margin notes, each independently switchable.

    $side is handed down from the caller, which knows whether it is drawing a
    recto or a verso footer. Fixed to the right, the notes fell on the binding
    edge of every left-hand page — invisible in a bound copy, and inconsistent
    with the header and footer either side of them, which already mirror.
  -->
  <xsl:template name="side-notes">
    <xsl:param name="side">right</xsl:param>
    <!-- Passed through from footer-content-odd/-even, which got it from
         whichever page-sequence template is currently running. See the note
         on $page-w in side-note-line for why this cannot be worked out here. -->
    <xsl:param name="page-h" select="$page-height"/>
    <xsl:param name="page-w" select="$page-width"/>
    <xsl:if test="$side.note.enabled = '1'">
      <xsl:call-template name="side-note-line">
        <xsl:with-param name="text" select="$side.note.text"/>
        <xsl:with-param name="top" select="$side.note.top"/>
        <xsl:with-param name="side" select="$side"/>
        <xsl:with-param name="page-w" select="$page-w"/>
      </xsl:call-template>
    </xsl:if>
    <xsl:if test="$produced.by.enabled = '1'">
      <!--
        Where the line has to start so its FOOT clears the footer rule.

        The first character sits at (top + length) and the text runs upward
        from there, so the foot is what has to be kept out of the footer, not
        the anchor. The footer band begins at
        page-height - bottom margin - footer extent — $page-h, the page
        actually being drawn, not the global $page-height: on a landscape
        page the two differ (A4 landscape's true height is $page-width's
        value), and computing this against the wrong one put the line's start
        102mm above where a 210mm-tall landscape page even begins — entirely
        off the page, on the wrong side of the top edge.
      -->
      <xsl:variable name="ph">
        <xsl:call-template name="length-number"><xsl:with-param name="v" select="$page-h"/></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="hunit">
        <xsl:call-template name="length-unit"><xsl:with-param name="v" select="$page-h"/></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="mb">
        <xsl:call-template name="length-number"><xsl:with-param name="v" select="$page-margin-bottom"/></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="fe">
        <xsl:call-template name="length-number"><xsl:with-param name="v" select="$region-after-extent"/></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="len">
        <xsl:call-template name="length-number"><xsl:with-param name="v" select="$side.note.length"/></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="clr">
        <xsl:call-template name="length-number"><xsl:with-param name="v" select="$side.note.clearance"/></xsl:call-template>
      </xsl:variable>
      <xsl:variable name="produced.top">
        <xsl:choose>
          <xsl:when test="normalize-space($produced.by.top) != ''">
            <xsl:value-of select="$produced.by.top"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="concat($ph - $mb - $fe - $clr - $len, $hunit)"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:variable>
      <xsl:call-template name="side-note-line">
        <xsl:with-param name="side" select="$side"/>
        <xsl:with-param name="page-w" select="$page-w"/>
        <!-- The enterprise name comes from the publication, not from Settings,
             so it cannot drift out of step with the module it appears on. -->
        <xsl:with-param name="text"
          select="concat($produced.by.prefix,
                         normalize-space(/pm/identAndStatusSection/pmStatus/responsiblePartnerCompany/enterpriseName))"/>
        <xsl:with-param name="top" select="$produced.top"/>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <!--
    Back in the footer, below the classification — on request, after the
    block-in-flow version above put it hard against a page's last line of
    body text on any module that happened to end near the bottom margin, with
    nothing between it and the running foot's own rule. On a short last page
    the two visually merged into one line.

    An fo:marker rather than a literal block: the module's true end can fall
    anywhere in its running text, but the mark needs to show ONCE, on
    whichever page that turns out to be, in a row that belongs to the FOOTER
    — a place this content never actually reaches at transform time, since
    the footer is generated once per page by the page master, long after this
    template has run. A marker is the one FO mechanism built for exactly
    that: set here, at the real end of content, and read back on whatever
    page FOP decides is last.

    retrieve-boundary="page-sequence" is what keeps it from leaking into the
    NEXT module: every data module runs in its own page-sequence, so the
    retrieval never looks outside the sequence this marker was set in.
    first-including-carryover is what makes it appear on the final page and
    every page after (there are none, within this sequence, once the module
    has actually ended) rather than only the exact page the marker land — the
    same retrieve-position every other running value in this footer uses.
  -->
  <xsl:template name="end-of-datamodule-marker">
    <fo:marker marker-class-name="chapter.end.of.dm">
      <xsl:value-of select="$end.of.dm.text"/>
    </fo:marker>
  </xsl:template>

  <!-- Wrapper templates for static-page header/footer calls -->
  <xsl:template name="header-odd">
    <xsl:call-template name="header-content"/>
  </xsl:template>

  <xsl:template name="header-even">
    <xsl:call-template name="header-content"/>
  </xsl:template>

  <xsl:template name="footer-odd">
    <xsl:call-template name="footer-content-odd"/>
  </xsl:template>

  <xsl:template name="footer-even">
    <xsl:call-template name="footer-content-even"/>
  </xsl:template>

  <!--
    Styling for the classification shown in the running head and foot.

    Emitted as attributes onto the caller's block so all three sites (header,
    odd footer, even footer) stay identical. Values come from Settings and
    default to what this engine already produced — bold, inherited colour, no
    underline — so an unset project is unchanged. See s1000dtofo.xsl.
  -->
  <xsl:template name="classification-style">
    <xsl:attribute name="font-weight"><xsl:value-of select="$classification.weight"/></xsl:attribute>
    <xsl:attribute name="text-decoration"><xsl:value-of select="$classification.decoration"/></xsl:attribute>
    <xsl:attribute name="padding-top"><xsl:value-of select="$classification.padding.top"/></xsl:attribute>
    <xsl:attribute name="padding-bottom"><xsl:value-of select="$classification.padding.bottom"/></xsl:attribute>
    <xsl:attribute name="padding-left"><xsl:value-of select="$classification.padding.left"/></xsl:attribute>
    <xsl:attribute name="padding-right"><xsl:value-of select="$classification.padding.right"/></xsl:attribute>
    <!-- "inherit" is the default so the banner keeps the header's own colour
         unless a house style actually asks for one. -->
    <xsl:if test="normalize-space($classification.color) != '' and $classification.color != 'inherit'">
      <xsl:attribute name="color"><xsl:value-of select="$classification.color"/></xsl:attribute>
    </xsl:if>
    <!-- Unset means "same size as the rest of the header", which is what the
         enclosing block already sets; only override when asked. -->
    <xsl:if test="normalize-space($classification.size) != ''">
      <xsl:attribute name="font-size"><xsl:value-of select="$classification.size"/></xsl:attribute>
    </xsl:if>
  </xsl:template>

  <!-- Security classification template -->
  <xsl:template match="security">
    <xsl:variable name="code">
      <xsl:choose>
        <xsl:when test="$security.classification != ''">
          <xsl:value-of select="$security.classification"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="@securityClassification"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$code = '01'">Unclassified</xsl:when>
      <xsl:when test="$code = '02'">Restricted</xsl:when>
      <xsl:when test="$code = '03'">Confidential</xsl:when>
      <xsl:when test="$code = '04'">Secret</xsl:when>
      <xsl:when test="$code = '05'">Top Secret</xsl:when>
      <xsl:otherwise><xsl:value-of select="$code"/></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!--
    The header logo.

    Delegates to the <symbol> template rather than building its own graphic.
    It used to resolve the ICN itself, from unparsed-entity-uri alone, and so
    printed nothing whenever the entity was missing or declared with an empty
    system identifier — even with the image sitting in Media/ under exactly
    that name, which the build's image index already knew about. Every other
    element resolves an ICN through that index; this one did not, and a header
    logo that silently fails to appear looks like a missing feature rather
    than a broken path.

    Delegating also means @reproductionHeight is honoured here as it is
    everywhere else. It is capped at the header's own extent, because the
    region cannot grow: a 20mm logo in a 16mm header would otherwise overlap
    the text below it.
  -->
  <xsl:template match="logo">
    <!--
      The tallest a logo can be without leaving the header band. The region has
      a fixed extent and the running head sits in it too, so the logo gets the
      extent less $logo.header.margin.
    -->
    <xsl:variable name="extent" select="number(translate($region-before-extent, translate($region-before-extent, '0123456789.', ''), ''))"/>
    <xsl:variable name="unit" select="translate($region-before-extent, '0123456789.', '')"/>
    <xsl:variable name="margin" select="number(translate($logo.header.margin, translate($logo.header.margin, '0123456789.', ''), ''))"/>
    <xsl:variable name="room" select="$extent - $margin"/>
    <!-- The author's height if it fits, otherwise as much as there is. -->
    <xsl:variable name="authored"
      select="number(translate(symbol/@reproductionHeight, translate(symbol/@reproductionHeight, '0123456789.', ''), ''))"/>
    <xsl:variable name="height">
      <xsl:choose>
        <xsl:when test="symbol/@reproductionHeight and $authored &lt; $room">
          <xsl:value-of select="symbol/@reproductionHeight"/>
        </xsl:when>
        <xsl:otherwise><xsl:value-of select="concat($room, $unit)"/></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:apply-templates select="symbol">
      <xsl:with-param name="force-height" select="$height"/>
    </xsl:apply-templates>
  </xsl:template>

  <!--
    There used to be a second template here (watermark-block): a hardcoded
    diagonal stamp at font-size="40", positioned with absolute-position="fixed"
    across most of the page, driven by a $watermark.text parameter no build
    ever sets (a stringparam of that name does not exist anywhere in
    engine/build.js), so $watermark.text was always its declared empty default
    and the block never rendered. It duplicated, with different hardcoded
    numbers, what the real mechanism ($watermark.image.uri, a background-image
    on region-body; see pagesetup.xsl's watermark-bg-attrs, sized correctly by
    server.js's printableBoxMm) already does properly. Dead code that looks
    like a second watermark system is worse than no comment at all here — the
    next person to touch a watermark bug would read it as live and lose time
    on it, so it is removed rather than left "just in case".
  -->

</xsl:stylesheet>
