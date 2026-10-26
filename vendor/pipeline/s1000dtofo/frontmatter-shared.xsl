<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     Shared front matter for the direct S1000D -> FO pipeline.

     The settings-driven front matter (joint title page, proprietary notice,
     foreword, record of changes, ... description of symbols) is rendered by
     the SAME stylesheet the JSS pipeline uses — ../jsstofo/frontmatter.xsl is
     included below rather than copied. That file is ~850 lines; duplicating it
     here would mean every future correction had to be made twice, and the two
     copies would inevitably drift. Including it keeps one definition, so both
     engines always produce identical front matter.

     Including it is safe because it only matches front-matter element names
     (proprietary, foreword, titlePageJoint, recordOfChanges, ...). None of
     those exist in S1000D, so there is no template collision with the data
     module templates in this pipeline. Its generic-element siblings in
     jsstofo/common.xsl are deliberately NOT included — those DO match para,
     table, note and friends, and would fight this pipeline's own templates.

     What this file supplies is the small adapter layer: the handful of named
     templates jsstofo/frontmatter.xsl calls that live outside it, re-expressed
     against this pipeline's page masters and running heads.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

  <xsl:include href="../jsstofo/frontmatter.xsl"/>

  <!-- ==================================================================== -->
  <!--        GLOBALS THE SHARED FRONT MATTER EXPECTS                        -->
  <!-- ==================================================================== -->
  <!--
    jsstofo/frontmatter.xsl reads these from its own driver (jsstofo.xsl),
    which this pipeline does not include. They are re-declared here against
    this pipeline's source shape.

    $meta is the book metadata block the build injects into the publication
    module (publishers, emblem, book/system name, publication numbers) — the
    same content the JSS pipeline carries in /jssbook/bookmeta.
  -->
  <xsl:variable name="meta" select="/pm/bookmeta"/>
  <xsl:variable name="system.name" select="normalize-space($meta/systemName)"/>
  <!-- $heading2-size is now a settings parameter in s1000dtofo.xsl (it drives
       the front-matter page titles, as it does in jsstofo). It was a fixed
       14pt here, which is why these titles were a size larger than the JSS
       engine's for the same book. Redeclaring it would be a compile error. -->
  <!-- Usable height of the cover page, for vertically centring its content. -->
  <xsl:variable name="cover-usable-height">240mm</xsl:variable>
  <!-- $lower / $upper / $jss.alpha.lower already exist in s1000dtofo.xsl and
       are reused as-is; redeclaring them here is a compile error. -->

  <!-- First data module in the publication, used to source the running
       head/foot values for the front matter. Resolved once (global) rather
       than per page-sequence, since //dmodule walks the whole merged tree. -->
  <xsl:variable name="fm.first.dm" select="(//dmodule)[1]"/>

  <!-- ==================================================================== -->
  <!--              JSS BOOK MARKUP USED BY THE FRONT-MATTER PAGES           -->
  <!-- ==================================================================== -->
  <!--
    The front-matter stencils are JSS book markup, not S1000D, so they use
    <deflist> and <list>. jsstofo/frontmatter.xsl (included above) renders the
    pages but leans on jsstofo/common.xsl for these, and that file cannot be
    pulled in wholesale here — it redefines para/title/etc. and would collide
    with this pipeline's own templates.

    Until now nothing matched them, so they hit the catch-all, which emits
    nothing and does not descend: the foreword's entire contact block and the
    whole demolition procedure were absent from every S1000D->FO PDF while
    appearing correctly in the JSS one.

    Matches are anchored under frontmatter/ so they can never shadow S1000D
    content vocabulary; S1000D's own lists are randomList/sequentialList and
    are handled elsewhere.
  -->
  <xsl:template match="frontmatter//deflist[not(defitem)]"/>
  <xsl:template match="frontmatter//list[not(item)]"/>

  <xsl:template match="frontmatter//deflist">
    <fo:table table-layout="fixed" width="140mm" space-after="3mm">
      <fo:table-column column-width="45mm"/>
      <fo:table-column column-width="10mm"/>
      <fo:table-column column-width="85mm"/>
      <fo:table-body>
        <xsl:apply-templates select="defitem"/>
      </fo:table-body>
    </fo:table>
  </xsl:template>

  <xsl:template match="frontmatter//defitem">
    <fo:table-row>
      <fo:table-cell padding-bottom="2mm">
        <fo:block><xsl:apply-templates select="term"/></fo:block>
      </fo:table-cell>
      <fo:table-cell padding-bottom="2mm">
        <fo:block>:</fo:block>
      </fo:table-cell>
      <fo:table-cell padding-bottom="2mm">
        <xsl:apply-templates select="def"/>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <xsl:template match="frontmatter//defitem/term">
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="frontmatter//defitem/def">
    <fo:block><xsl:apply-templates/></fo:block>
  </xsl:template>

  <!-- Each <line> is its own block, so a multi-line address stacks. -->
  <xsl:template match="frontmatter//line">
    <fo:block><xsl:apply-templates/></fo:block>
  </xsl:template>

  <!--
    Labels come from xsl:number rather than this pipeline's list machinery:
    the @type values here are the JSS book's (roman/alpha/arabic/bullet), and
    XSLT 1.0 formats those directly, so no list parameters are needed.
  -->
  <xsl:template match="frontmatter//list">
    <!-- Label column from Settings > Lists, per label style, so front-matter
         lists follow the same spacing rules as body lists. -->
    <xsl:variable name="gap">
      <xsl:choose>
        <xsl:when test="@type = 'roman'"><xsl:value-of select="$list.gap.roman"/></xsl:when>
        <xsl:when test="@type = 'alpha'"><xsl:value-of select="$list.gap.alpha"/></xsl:when>
        <xsl:when test="@type = 'arabic'"><xsl:value-of select="$list.gap.alpha"/></xsl:when>
        <xsl:otherwise><xsl:value-of select="$list.gap.bullet"/></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <fo:list-block space-after="3mm"
                   provisional-distance-between-starts="{concat($gap, 'mm')}"
                   provisional-label-separation="2mm">
      <xsl:apply-templates select="item"/>
    </fo:list-block>
  </xsl:template>

  <xsl:template match="frontmatter//list/item">
    <xsl:variable name="type" select="string(parent::list/@type)"/>
    <fo:list-item space-after="{concat($list.item.space, 'mm')}">
      <fo:list-item-label end-indent="label-end()">
        <fo:block>
          <xsl:choose>
            <xsl:when test="$type = 'roman'">
              <xsl:text>(</xsl:text><xsl:number value="position()" format="i"/><xsl:text>)</xsl:text>
            </xsl:when>
            <xsl:when test="$type = 'alpha'">
              <xsl:text>(</xsl:text><xsl:number value="position()" format="a"/><xsl:text>)</xsl:text>
            </xsl:when>
            <xsl:when test="$type = 'arabic'">
              <xsl:number value="position()" format="1"/><xsl:text>.</xsl:text>
            </xsl:when>
            <xsl:otherwise>&#8226;</xsl:otherwise>
          </xsl:choose>
        </fo:block>
      </fo:list-item-label>
      <fo:list-item-body start-indent="body-start()">
        <fo:block><xsl:apply-templates/></fo:block>
      </fo:list-item-body>
    </fo:list-item>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    FRONT-MATTER RUNNING-HEAD MARKERS                  -->
  <!-- ==================================================================== -->
  <!--
    header-content / footer-content-* are built entirely from fo:retrieve-marker,
    and markers only resolve inside the page-sequence that emits them. The front
    matter has no dmodule to run generate-markers over, so without this the
    prelim pages rendered the header/footer rules with every cell empty while
    the body pages showed logo / classification / publication code — the two
    halves of the book looked like different documents.

    Emitting the same marker classes at the top of each prelim flow makes the
    identical templates produce identical output. Values come from the first
    data module so they match the body exactly (the PM's own pmCode carries a
    placeholder modelIdentCode and would print a different publication code).

    chapter.applicability and chapter.data.module.code are deliberately left
    unset: front matter belongs to no data module, so those footer cells stay
    empty by design rather than by accident.
  -->
  <xsl:template name="frontmatter-markers">
    <fo:marker marker-class-name="chapter.classification">
      <xsl:choose>
        <xsl:when test="$fm.first.dm/identAndStatusSection/dmStatus/security">
          <xsl:apply-templates select="$fm.first.dm/identAndStatusSection/dmStatus/security"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="/pm/identAndStatusSection/pmStatus/security"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:marker>

    <!--
      The same header line as the body pages, and it has to be built the same
      way. The front matter carries its own copy of these markers because it
      has no data module to take them from; when the body's version learned to
      honour the Settings header text, this one did not, and setting it changed
      the running head over half the book and left the prelims saying something
      else.
    -->
    <fo:marker marker-class-name="publication.code">
      <xsl:choose>
        <xsl:when test="normalize-space($header.publication.text) != ''">
          <xsl:value-of select="$header.publication.text"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:choose>
            <xsl:when test="$fm.first.dm/identAndStatusSection/dmAddress/dmIdent/dmCode/@modelIdentCode">
              <xsl:value-of select="$fm.first.dm/identAndStatusSection/dmAddress/dmIdent/dmCode/@modelIdentCode"/>
            </xsl:when>
            <xsl:otherwise>
              <xsl:value-of select="/pm/identAndStatusSection/pmAddress/pmIdent/pmCode/@modelIdentCode"/>
            </xsl:otherwise>
          </xsl:choose>
          <xsl:value-of select="$header.publication.suffix"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:marker>

    <fo:marker marker-class-name="chapter.issue.date">
      <xsl:choose>
        <xsl:when test="$fm.first.dm/identAndStatusSection/dmAddress/dmAddressItems/issueDate">
          <xsl:apply-templates select="$fm.first.dm/identAndStatusSection/dmAddress/dmAddressItems/issueDate"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="/pm/identAndStatusSection/pmAddress/pmAddressItems/issueDate"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:marker>

    <fo:marker marker-class-name="page.header.logo">
      <xsl:choose>
        <xsl:when test="$fm.first.dm/identAndStatusSection/dmStatus/logo">
          <xsl:apply-templates select="$fm.first.dm/identAndStatusSection/dmStatus/logo"/>
        </xsl:when>
        <xsl:when test="/pm/identAndStatusSection/pmStatus/logo">
          <xsl:apply-templates select="/pm/identAndStatusSection/pmStatus/logo"/>
        </xsl:when>
      </xsl:choose>
    </fo:marker>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--          PAGE-SEQUENCE ADAPTERS (jsstofo/pagesetup.xsl)              -->
  <!-- ==================================================================== -->
  <!--
    One front-matter "part" per page sequence, on this pipeline's masters.
    Roman folios, and the same end-on-even discipline the body uses so each
    part opens on a right-hand page; the filler page FOP inserts carries the
    "intentionally left blank" legend from the blank master's background.
  -->
  <xsl:template name="prelim-part-sequence">
    <xsl:param name="content"/>
    <!-- '1' only for the opening part; later parts continue the folio. -->
    <xsl:param name="first">0</xsl:param>
    <xsl:if test="normalize-space(string($content)) != ''">
      <fo:page-sequence master-reference="body" format="i">
        <xsl:attribute name="initial-page-number">
          <xsl:choose>
            <xsl:when test="$first = '1'">1</xsl:when>
            <xsl:otherwise>auto</xsl:otherwise>
          </xsl:choose>
        </xsl:attribute>
        <xsl:if test="$blank.versos = '1'">
          <xsl:attribute name="force-page-count">end-on-even</xsl:attribute>
        </xsl:if>
        <fo:static-content flow-name="xsl-region-before-first">
          <xsl:call-template name="header-content"/>
        </fo:static-content>
        <fo:static-content flow-name="xsl-region-before-odd">
          <xsl:call-template name="header-content"/>
        </fo:static-content>
        <fo:static-content flow-name="xsl-region-before-even">
          <xsl:call-template name="header-content">
            <xsl:with-param name="verso">1</xsl:with-param>
          </xsl:call-template>
        </fo:static-content>
        <fo:static-content flow-name="xsl-region-after-first">
          <xsl:call-template name="footer-content-odd"/>
        </fo:static-content>
        <fo:static-content flow-name="xsl-region-after-odd">
          <xsl:call-template name="footer-content-odd"/>
        </fo:static-content>
        <fo:static-content flow-name="xsl-region-after-even">
          <xsl:call-template name="footer-content-even"/>
        </fo:static-content>
        <!-- No static-content for the blank region: the XSL-FO spec forbids
             fo:static-content targeting region-body, which is why the legend
             is a background-image on the blank master instead. -->
        <fo:flow flow-name="xsl-region-body" font-size="{$font-size}" font-family="{$font-stack}" line-height="{$line-height}">
          <!-- Must be the initial children of the flow so the running head and
               foot above can retrieve them on every page of this sequence. -->
          <xsl:call-template name="frontmatter-markers"/>
          <xsl:copy-of select="$content"/>
        </fo:flow>
      </fo:page-sequence>
    </xsl:if>
  </xsl:template>

  <!--
    Title/cover pages. force-page-count="no-force" and no initial-page-number,
    matching the JSS pipeline: the blank verso after a title page is emitted
    explicitly by cover-blank-verso, so letting FOP *also* pad these sequences
    would stack several blank pages in a row, and restarting the folio on each
    one would renumber the book from 1 at every title page.
  -->
  <xsl:template name="cover-page-sequence">
    <xsl:param name="content"/>
    <xsl:if test="normalize-space(string($content)) != ''">
      <fo:page-sequence master-reference="body" force-page-count="no-force">
        <fo:flow flow-name="xsl-region-body" font-size="{$font-size}" font-family="{$font-stack}" line-height="{$line-height}">
          <xsl:copy-of select="$content"/>
        </fo:flow>
      </fo:page-sequence>
    </xsl:if>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                        PDF BOOKMARKS                                  -->
  <!-- ==================================================================== -->
  <!--
    The navigation pane a PDF reader shows down the side. This is separate
    from the printed LIST OF CONTENTS page: without an fo:bookmark-tree a
    viewer reports "this document has no table of contents" even though the
    contents page is present in the body.

    Chapters come from the top-level pmEntry list, their entries from the data
    modules inside, pointing at the same "content-start-<id>" anchors the body
    emits so a click lands on the right page.
  -->
  <xsl:template name="bookmark-tree">
    <xsl:if test="/pm/content/pmEntry//dmodule">
      <fo:bookmark-tree>
        <xsl:for-each select="/pm/content/pmEntry">
          <xsl:variable name="firstDm" select="(.//dmodule)[1]"/>
          <xsl:if test="$firstDm">
            <fo:bookmark internal-destination="{concat('content-start-', generate-id($firstDm))}">
              <fo:bookmark-title>
                <xsl:text>Chapter </xsl:text>
                <xsl:value-of select="position()"/>
                <xsl:if test="pmEntryTitle">
                  <xsl:text> - </xsl:text>
                  <xsl:value-of select="pmEntryTitle"/>
                </xsl:if>
              </fo:bookmark-title>
              <xsl:for-each select=".//dmodule">
                <fo:bookmark internal-destination="{concat('content-start-', generate-id(.))}">
                  <fo:bookmark-title>
                    <!--
                      The book's own name for this entry, taken from the
                      publication module, not the data module's catalogue
                      dmTitle. "Flow Schematic" is what the PM calls the
                      section; "Flow Schematic - Technical description of the
                      equipment" is the S1000D information type appended to it,
                      and that second half is the same boilerplate on every
                      module of that type — it filled the bookmark strip with
                      noise and pushed the distinguishing half out of view.

                      ancestor::pmEntry is a reverse axis, so [1] after the
                      predicates is the NEAREST titled entry; not(parent::content)
                      excludes the chapter, which is already the parent bookmark.
                      With no such title (a module sitting bare under a chapter)
                      this falls back to the dmTitle exactly as before.
                    -->
                    <xsl:variable name="entryTitle"
                      select="ancestor::pmEntry[pmEntryTitle][not(parent::content)][1]/pmEntryTitle"/>
                    <xsl:choose>
                      <xsl:when test="normalize-space($entryTitle) != ''">
                        <xsl:value-of select="normalize-space($entryTitle)"/>
                      </xsl:when>
                      <xsl:otherwise>
                        <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
                        <xsl:if test="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName">
                          <xsl:text> - </xsl:text>
                          <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName"/>
                        </xsl:if>
                      </xsl:otherwise>
                    </xsl:choose>
                  </fo:bookmark-title>
                </fo:bookmark>
              </xsl:for-each>
            </fo:bookmark>
          </xsl:if>
        </xsl:for-each>
      </fo:bookmark-tree>
    </xsl:if>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--        CONTENTS / FIGURES / TABLES  (built from the S1000D source)    -->
  <!-- ==================================================================== -->
  <!--
    frontmatter-prelims wraps these three in page sequences, but their JSS
    implementations live in jsstofo/toc.xsl and read /jssbook/body — a tree
    this pipeline never produces, so they would come out empty. They are
    therefore implemented here against the publication module itself, using
    this pipeline's own figure/table numbering so the entries match the
    captions printed in the body.

    Data modules are pulled in by xi:include before the transform runs, so a
    plain //figure over the PM sees the whole publication.
  -->
  <!--
    One contents line: an optional label column, the title, a dot leader and
    the real page number. Mirrors the JSS pipeline's toc-line so both engines'
    contents pages read the same.
  -->
  <!--
    Start-indent for a contents entry $level deep: the base indent plus one
    label column per level below the first. Level 1 is a data module (1.1),
    level 2 a section within it (1.1.1), and so on.

    Both operands carry their unit, so this strips and re-appends it rather
    than assuming millimetres — the two are configurable and a bare number
    here would silently produce "18" with no unit if either were given in pt.
  -->
  <xsl:template name="toc-indent-for-level">
    <xsl:param name="level" select="1"/>
    <xsl:variable name="base" select="number(translate($toc.entry.indent, translate($toc.entry.indent, '0123456789.', ''), ''))"/>
    <xsl:variable name="unit" select="translate($toc.entry.indent, '0123456789.', '')"/>
    <xsl:variable name="col" select="number(translate($toc.label.width, translate($toc.label.width, '0123456789.', ''), ''))"/>
    <xsl:value-of select="concat($base + $col * ($level - 1), $unit)"/>
  </xsl:template>

  <!--
    One contents line.

    A numbered line ($column = 1) puts its number in a fixed-width column and
    its title after it, so every title on the page starts at the same offset
    however wide the number is. Inline text plus a couple of spaces cannot do
    that: "1.1" and "1.1.10" are different widths, so each level began at a
    slightly different place and a nested entry started to the LEFT of its
    parent's title rather than square with it.

    Because the column is a fixed width, indenting a child by exactly one
    column lands its number under its parent's title:

        1.1     Introduction to the Equipment
                1.1.1   Introduction to the Equipment

    Unnumbered lines, and the chapter heading (whose "CHAPTER 1" label is far
    wider than a section number and is meant to sit tight against its title),
    keep the simpler inline form.
  -->
  <xsl:template name="fm-toc-line">
    <xsl:param name="text"/>
    <xsl:param name="ref"/>
    <xsl:param name="label"/>
    <xsl:param name="bold">0</xsl:param>
    <xsl:param name="indent">0mm</xsl:param>
    <!-- 1 to put the label in its own column; 0 for the inline form. -->
    <xsl:param name="column">0</xsl:param>

    <xsl:variable name="tail">
      <fo:leader leader-pattern="dots" leader-alignment="reference-area"/>
      <fo:page-number-citation ref-id="{$ref}"/>
    </xsl:variable>

    <xsl:choose>
      <xsl:when test="$column = '1' and normalize-space($label) != ''">
        <fo:list-block start-indent="{$indent}" space-after="1.2mm" font-size="{$font-size}"
                       provisional-distance-between-starts="{$toc.label.width}"
                       provisional-label-separation="0mm">
          <fo:list-item>
            <fo:list-item-label end-indent="label-end()">
              <fo:block>
                <fo:basic-link internal-destination="{$ref}">
                  <xsl:value-of select="$label"/>
                </fo:basic-link>
              </fo:block>
            </fo:list-item-label>
            <fo:list-item-body start-indent="body-start()">
              <fo:block text-align-last="justify">
                <fo:basic-link internal-destination="{$ref}">
                  <xsl:copy-of select="$text"/>
                </fo:basic-link>
                <xsl:copy-of select="$tail"/>
              </fo:block>
            </fo:list-item-body>
          </fo:list-item>
        </fo:list-block>
      </xsl:when>
      <xsl:otherwise>
        <fo:block text-align-last="justify" space-after="1.2mm" font-size="{$font-size}"
                  start-indent="{$indent}">
          <xsl:if test="$bold = '1'">
            <xsl:attribute name="font-weight">bold</xsl:attribute>
            <xsl:attribute name="space-before">2.5mm</xsl:attribute>
          </xsl:if>
          <fo:basic-link internal-destination="{$ref}">
            <xsl:if test="normalize-space($label) != ''">
              <fo:inline><xsl:value-of select="$label"/><xsl:text>&#160;&#160;</xsl:text></fo:inline>
            </xsl:if>
            <xsl:copy-of select="$text"/>
          </fo:basic-link>
          <xsl:copy-of select="$tail"/>
        </fo:block>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!--
    The id the body actually emitted for this node, so the citation and the
    link resolve to the real page.

    Only ever called for a figure or a table, and the two engines' body
    templates build their ids differently, so this has to dispatch rather than
    assume: a figure keeps its authored id on the first element carrying it
    (unique-id), while a table is always dmCode-scoped (generate-link-id) or,
    with no authored id, "table-auto-<generated>".

    Emitting the bare @id for both — which is what this did — was right for a
    figure and always wrong for a table, so every List of Tables entry pointed
    at an id that did not exist and the whole list was dead links.
  -->
  <xsl:template name="fm-node-id">
    <xsl:choose>
      <xsl:when test="self::figure">
        <xsl:call-template name="unique-id"/>
      </xsl:when>
      <xsl:when test="@id">
        <xsl:call-template name="generate-link-id">
          <xsl:with-param name="localId" select="@id"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:when test="self::table">
        <xsl:text>table-auto-</xsl:text>
        <xsl:value-of select="generate-id()"/>
      </xsl:when>
      <xsl:otherwise><xsl:value-of select="generate-id(.)"/></xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!--
    Contents: each top-level pmEntry is a chapter and the data modules inside
    it are its numbered entries — CHAPTER 1, then 1.1, 1.2, and so on, the
    numbering the printed stencil uses. Sections within a module continue the
    scheme (1.1.1, 1.1.2) but are listed only as deep as $toc.section.depth
    allows, so a large publication's contents does not run to dozens of pages.

    The depth counts levels below the chapter: 1 lists the modules and nothing
    more (1.1), 2 adds their top-level sections (1.1.1), and so on. 1 is the
    default because a single-topic module names its one section after itself,
    so listing that level repeats the same title twice in a row at two
    indents — informative only where a module really does hold several topics.

    Page references point at the ids the body actually emits —
    "content-start-<generate-id>" for a module, generate-id() for a section —
    so every line resolves to a real page rather than a dead link.
  -->
  <xsl:template match="listOfContents">
    <fo:block break-before="page">
      <xsl:call-template name="page-title">
        <xsl:with-param name="text">
          <xsl:call-template name="fm-heading">
            <xsl:with-param name="override" select="$fm.title.listOfContents"/>
            <xsl:with-param name="default">LIST OF CONTENTS</xsl:with-param>
          </xsl:call-template>
        </xsl:with-param>
      </xsl:call-template>
      <xsl:for-each select="/pm/content/pmEntry">
        <xsl:variable name="chapNo" select="position()"/>
        <xsl:variable name="firstDm" select="(.//dmodule)[1]"/>
        <xsl:if test="$firstDm">
          <xsl:call-template name="fm-toc-line">
            <xsl:with-param name="bold">1</xsl:with-param>
            <xsl:with-param name="label" select="concat('CHAPTER ', $chapNo)"/>
            <xsl:with-param name="ref" select="concat('content-start-', generate-id($firstDm))"/>
            <xsl:with-param name="text">
              <xsl:choose>
                <xsl:when test="pmEntryTitle">
                  <xsl:value-of select="translate(pmEntryTitle, $lower, $upper)"/>
                </xsl:when>
                <xsl:otherwise>
                  <xsl:value-of select="translate($firstDm/identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName, $lower, $upper)"/>
                </xsl:otherwise>
              </xsl:choose>
            </xsl:with-param>
          </xsl:call-template>
        </xsl:if>

        <xsl:for-each select=".//dmodule">
          <xsl:variable name="dm" select="."/>
          <!-- "1.1", "1.2" ... position() is the module's index within this
               chapter, which is exactly the numbering the printed contents
               uses. -->
          <xsl:variable name="secNo" select="concat($chapNo, '.', position())"/>
          <xsl:call-template name="fm-toc-line">
            <xsl:with-param name="indent" select="$toc.entry.indent"/>
            <xsl:with-param name="column">1</xsl:with-param>
            <xsl:with-param name="label" select="$secNo"/>
            <xsl:with-param name="ref" select="concat('content-start-', generate-id($dm))"/>
            <!--
              techName alone. infoName is the S1000D information-type name —
              "Description of function attributed to crew (functional
              breakdown)" and the like — which is longer than the title it
              qualifies, wraps the line, and repeats down the page. It stays on
              the module's own title in the body, where there is room for it.
            -->
            <xsl:with-param name="text"
              select="normalize-space(identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName)"/>
          </xsl:call-template>

          <!--
            Sections within a module, numbered under it: 1.1.1, 1.1.2 ...

            $toc.section.depth counts LEVELS BELOW THE CHAPTER, so 1 is the
            module line alone (1.1) and 2 adds these. Hence the "- 1": the
            module has already used up the first level. The JSS engine counts
            the same way — its sections ARE the entries, so its predicate needs
            no adjustment — and one Settings control therefore means the same
            thing whichever engine a project builds with. Before this it did
            not: 1 meant "1.1" there and "down to 1.1.1" here.
          -->
          <xsl:for-each select=".//levelledPara[title][count(ancestor::levelledPara) &lt; number($toc.section.depth) - 1]">
            <!--
              One label column further in per level, so a child's number sits
              directly under its parent's TITLE rather than somewhere between
              the parent's number and title. mm-add keeps this arithmetic
              honest about the unit instead of assuming millimetres.
            -->
            <!-- +2, not +1: the data module is itself level 1 (numbered 1.1),
                 so its outermost levelledPara is level 2 (1.1.1). -->
            <xsl:variable name="lvl" select="count(ancestor::levelledPara) + 2"/>
            <xsl:call-template name="fm-toc-line">
              <xsl:with-param name="indent">
                <xsl:call-template name="toc-indent-for-level">
                  <xsl:with-param name="level" select="$lvl"/>
                </xsl:call-template>
              </xsl:with-param>
              <xsl:with-param name="column">1</xsl:with-param>
              <xsl:with-param name="label" select="concat($secNo, '.', position())"/>
              <xsl:with-param name="ref" select="generate-id(.)"/>
              <xsl:with-param name="text" select="normalize-space(title)"/>
            </xsl:call-template>
          </xsl:for-each>
        </xsl:for-each>
      </xsl:for-each>
    </fo:block>
  </xsl:template>

  <xsl:template match="listOfFigures">
    <fo:block break-before="page">
      <xsl:call-template name="page-title">
        <xsl:with-param name="text">
          <xsl:call-template name="fm-heading">
            <xsl:with-param name="override" select="$fm.title.listOfFigures"/>
            <xsl:with-param name="default">LIST OF FIGURES</xsl:with-param>
          </xsl:call-template>
        </xsl:with-param>
      </xsl:call-template>
      <xsl:for-each select="/pm//figure[title]">
        <xsl:call-template name="fm-toc-line">
          <xsl:with-param name="ref"><xsl:call-template name="fm-node-id"/></xsl:with-param>
          <xsl:with-param name="text">
            <xsl:text>Fig </xsl:text>
            <xsl:apply-templates select="." mode="number"/>
            <xsl:text>  </xsl:text>
            <xsl:value-of select="normalize-space(title)"/>
          </xsl:with-param>
        </xsl:call-template>
      </xsl:for-each>
    </fo:block>
  </xsl:template>

  <xsl:template match="listOfTables">
    <fo:block break-before="page">
      <xsl:call-template name="page-title">
        <xsl:with-param name="text">
          <xsl:call-template name="fm-heading">
            <xsl:with-param name="override" select="$fm.title.listOfTables"/>
            <xsl:with-param name="default">LIST OF TABLES</xsl:with-param>
          </xsl:call-template>
        </xsl:with-param>
      </xsl:call-template>
      <xsl:for-each select="/pm//table[title]">
        <xsl:call-template name="fm-toc-line">
          <xsl:with-param name="ref"><xsl:call-template name="fm-node-id"/></xsl:with-param>
          <xsl:with-param name="text">
            <xsl:text>Table </xsl:text>
            <!--
              The caption's own numbering, not a second count of its own. This
              list counted every titled table from the root while the caption
              counted from the data module, so the list said Table 7 and the
              page said Table 2 — the reader's only way to find a table
              disagreeing with the table.
            -->
            <xsl:apply-templates select="." mode="number"/>
            <xsl:text>  </xsl:text>
            <xsl:value-of select="normalize-space(title)"/>
          </xsl:with-param>
        </xsl:call-template>
      </xsl:for-each>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--            SMALL UTILITIES (jsstofo/common.xsl)                       -->
  <!-- ==================================================================== -->
  <!-- Copied rather than included: their home file also matches para/table/
       note, which would collide with this pipeline's own templates. They are
       a few lines each and have no dependencies of their own.
       ($jss.alpha.lower is already declared in s1000dtofo.xsl.) -->
  <xsl:template name="jss-alpha">
    <xsl:param name="n"/>
    <xsl:variable name="len" select="string-length($jss.alpha.lower)"/>
    <xsl:choose>
      <xsl:when test="$n &gt; $len">
        <xsl:call-template name="jss-alpha">
          <xsl:with-param name="n" select="floor(($n - 1) div $len)"/>
        </xsl:call-template>
        <xsl:value-of select="substring($jss.alpha.lower, (($n - 1) mod $len) + 1, 1)"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="substring($jss.alpha.lower, $n, 1)"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="page-title">
    <xsl:param name="text"/>
    <fo:block text-align="center" font-size="{$heading2-size}" font-weight="bold"
              space-after="6mm" keep-with-next.within-page="always">
      <xsl:value-of select="$text"/>
    </fo:block>
  </xsl:template>

  <xsl:template name="red-box">
    <xsl:param name="content"/>
    <xsl:param name="align">justify</xsl:param>
    <fo:block border="0.8pt solid #CC0000" padding="3mm" color="#CC0000"
              margin-left="0mm" margin-right="0mm"
              text-align="{$align}" space-after="6mm">
      <xsl:copy-of select="$content"/>
    </fo:block>
  </xsl:template>

</xsl:stylesheet>
